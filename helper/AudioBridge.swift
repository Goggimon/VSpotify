import Foundation
import ScreenCaptureKit
import Accelerate
import Network
import CoreMedia

// VSpotify macOS System Audio -> 60fps FFT WebSocket Bridge (ws://127.0.0.1:8889)
// Compile: swiftc helper/AudioBridge.swift -O -o helper/vspotify-audio
// Run:     ./helper/vspotify-audio

final class WebSocketHub {
    private var listener: NWListener?
    private var clients: [NWConnection] = []
    private let queue = DispatchQueue(label: "vspotify.ws")

    func start(port: UInt16 = 8889) throws {
        let params = NWParameters.tcp
        let wsOptions = NWProtocolWebSocket.Options()
        wsOptions.autoReplyPing = true
        params.defaultProtocolStack.applicationProtocols.insert(wsOptions, at: 0)

        let nwPort = NWEndpoint.Port(rawValue: port)!
        listener = try NWListener(using: params, on: nwPort)
        listener?.newConnectionHandler = { [weak self] conn in
            self?.handleNewConnection(conn)
        }
        listener?.start(queue: queue)
        print("[VSpotify Audio] WebSocket listening on ws://127.0.0.1:\(port)")
    }

    private func handleNewConnection(_ conn: NWConnection) {
        conn.stateUpdateHandler = { [weak self] state in
            if case .failed = state { self?.remove(conn) }
            if case .cancelled = state { self?.remove(conn) }
        }
        conn.start(queue: queue)
        clients.append(conn)
    }

    private func remove(_ conn: NWConnection) {
        clients.removeAll { $0 === conn }
    }

    func broadcast(_ bytes: [UInt8]) {
        guard !clients.isEmpty else { return }
        let data = Data(bytes)
        let meta = NWProtocolWebSocket.Metadata(opcode: .binary)
        let context = NWConnection.ContentContext(identifier: "fft", metadata: [meta])

        for conn in clients {
            conn.send(content: data, contentContext: context, isComplete: true, completion: .idempotent)
        }
    }
}

final class SystemAudioTap: NSObject, SCStreamOutput {
    private let hub: WebSocketHub
    private let fftSize = 512
    private var log2n: vDSP_Length { vDSP_Length(log2(Float(fftSize))) }
    private var fftSetup: FFTSetup?
    private var window: [Float]
    private var ringBuffer: [Float]
    private var lastEmit = DispatchTime.now()

    init(hub: WebSocketHub) {
        self.hub = hub
        self.window = [Float](repeating: 0, count: 512)
        self.ringBuffer = [Float](repeating: 0, count: 512)
        super.init()
        vDSP_hann_window(&window, vDSP_Length(fftSize), Int32(vDSP_HANN_NORM))
        fftSetup = vDSP_create_fftsetup(log2n, FFTRadix(kFFTRadix2))
    }

    deinit {
        if let setup = fftSetup { vDSP_destroy_fftsetup(setup) }
    }

    func start() async throws {
        let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: false)
        guard let display = content.displays.first else {
            throw NSError(domain: "VSpotify", code: 1, userInfo: [NSLocalizedDescriptionKey: "No display found"])
        }

        let filter = SCContentFilter(display: display, excludingWindows: [])
        let config = SCStreamConfiguration()
        config.capturesAudio = true
        config.excludesCurrentProcessAudio = true
        config.sampleRate = 48000
        config.channelCount = 1
        // Minimal video footprint since ScreenCaptureKit requires display filter
        config.width = 2
        config.height = 2
        config.minimumFrameInterval = CMTime(value: 1, timescale: 1)

        let stream = SCStream(filter: filter, configuration: config, delegate: nil)
        try stream.addStreamOutput(self, type: .audio, sampleHandlerQueue: DispatchQueue(label: "vspotify.audio"))
        try await stream.startCapture()
        print("[VSpotify Audio] Capturing macOS system audio -> 60fps FFT")
    }

    func stream(_ stream: SCStream, didOutputSampleBuffer sampleBuffer: CMSampleBuffer, of type: SCStreamOutputType) {
        guard type == .audio,
              let block = CMSampleBufferGetDataBuffer(sampleBuffer) else { return }

        var length = 0
        var ptr: UnsafeMutablePointer<Int8>?
        CMBlockBufferGetDataPointer(block, atOffset: 0, lengthAtOffsetOut: nil, totalLengthOut: &length, dataPointerOut: &ptr)
        guard let rawPtr = ptr else { return }

        let floatCount = length / MemoryLayout<Float>.size
        let samples = UnsafeBufferPointer(start: UnsafeRawPointer(rawPtr).assumingMemoryBound(to: Float.self), count: floatCount)

        if floatCount >= fftSize {
            ringBuffer = Array(samples.suffix(fftSize))
        } else if floatCount > 0 {
            ringBuffer.removeFirst(min(floatCount, ringBuffer.count))
            ringBuffer.append(contentsOf: samples)
        }

        let now = DispatchTime.now()
        let elapsedMs = Double(now.uptimeNanoseconds - lastEmit.uptimeNanoseconds) / 1_000_000.0
        guard elapsedMs >= 16.0 else { return } // ~60fps cap
        lastEmit = now

        emitFFT()
    }

    private func emitFFT() {
        guard let setup = fftSetup else { return }
        var windowed = [Float](repeating: 0, count: fftSize)
        vDSP_vmul(ringBuffer, 1, window, 1, &windowed, 1, vDSP_Length(fftSize))

        var real = [Float](repeating: 0, count: fftSize / 2)
        var imag = [Float](repeating: 0, count: fftSize / 2)

        real.withUnsafeMutableBufferPointer { rPtr in
            imag.withUnsafeMutableBufferPointer { iPtr in
                var split = DSPSplitComplex(realp: rPtr.baseAddress!, imagp: iPtr.baseAddress!)
                windowed.withUnsafeBufferPointer { wPtr in
                    wPtr.baseAddress!.withMemoryRebound(to: DSPComplex.self, capacity: fftSize / 2) { complexPtr in
                        vDSP_ctoz(complexPtr, 2, &split, 1, vDSP_Length(fftSize / 2))
                    }
                }
                vDSP_fft_zrip(setup, &split, 1, log2n, FFTDirection(FFT_FORWARD))
                var mags = [Float](repeating: 0, count: fftSize / 2)
                vDSP_zvmags(&split, 1, &mags, 1, vDSP_Length(fftSize / 2))

                // Map to 128-bin Uint8 spectrum (0..255)
                var bins = [UInt8](repeating: 0, count: 128)
                for i in 0..<128 {
                    let db = 10.0 * log10f(max(mags[i], 1e-7))
                    let norm = max(0, min(1, (db + 55.0) / 55.0))
                    bins[i] = UInt8(norm * 255.0)
                }
                hub.broadcast(bins)
            }
        }
    }
}

@main
struct AudioBridgeApp {
    static func main() async {
        let hub = WebSocketHub()
        do {
            try hub.start(port: 8889)
            let tap = SystemAudioTap(hub: hub)
            try await tap.start()
            while true {
                try await Task.sleep(nanoseconds: 1_000_000_000)
            }
        } catch {
            fputs("[VSpotify Audio] Error: \(error.localizedDescription)\n", stderr)
            exit(1)
        }
    }
}
