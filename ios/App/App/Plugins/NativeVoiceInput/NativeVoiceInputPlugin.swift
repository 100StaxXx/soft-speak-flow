import Foundation
import Capacitor
import Speech
import AVFoundation
import UIKit

/// Captures live speech and metering on the same audio input. All lifecycle state lives on main.
@objc(NativeVoiceInputPlugin)
public class NativeVoiceInputPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeVoiceInputPlugin"
    public let jsName = "NativeVoiceInput"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "requestPermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise)
    ]
    private var sessionID: String?
    private var engine: AVAudioEngine?
    private var recognizer: SFSpeechRecognizer?
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private var finishTimer: Timer?
    private var maximumTimer: Timer?
    private var stopping = false
    private var hasTap = false
    private var previousAudio: (AVAudioSession.Category, AVAudioSession.Mode, AVAudioSession.CategoryOptions)?
    private var observers: [NSObjectProtocol] = []

    public override func load() {
        observers.append(NotificationCenter.default.addObserver(forName: AVAudioSession.interruptionNotification, object: nil, queue: .main) { [weak self] note in
            guard (note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt) == AVAudioSession.InterruptionType.began.rawValue else { return }
            self?.interrupt()
        })
        observers.append(NotificationCenter.default.addObserver(forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: .main) { [weak self] _ in self?.interrupt() })
        observers.append(NotificationCenter.default.addObserver(forName: AVAudioSession.routeChangeNotification, object: nil, queue: .main) { [weak self] note in
            guard (note.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt) == AVAudioSession.RouteChangeReason.oldDeviceUnavailable.rawValue else { return }
            self?.interrupt()
        })
    }
    deinit { observers.forEach(NotificationCenter.default.removeObserver) }

    @objc public func requestPermission(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            SFSpeechRecognizer.requestAuthorization { status in
                guard status == .authorized else { call.resolve(["status": "denied"]); return }
                AVAudioSession.sharedInstance().requestRecordPermission { granted in
                    call.resolve(["status": granted ? "granted" : "denied"])
                }
            }
        }
    }

    @objc public func start(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let id = call.getString("sessionId"), !id.isEmpty else { call.reject("Missing session", "start-failed"); return }
            self.finish()
            self.sessionID = id
            SFSpeechRecognizer.requestAuthorization { status in
                DispatchQueue.main.async {
                    guard self.sessionID == id else { call.resolve(); return }
                    guard status == .authorized else { self.fail(call, code: "service-not-allowed"); return }
                    AVAudioSession.sharedInstance().requestRecordPermission { granted in
                        DispatchQueue.main.async {
                            guard self.sessionID == id else { call.resolve(); return }
                            guard granted else { self.fail(call, code: "not-allowed"); return }
                            self.begin(id: id, language: call.getString("language") ?? Locale.current.identifier, call: call)
                        }
                    }
                }
            }
        }
    }

    private func begin(id: String, language: String, call: CAPPluginCall) {
        guard let recognizer = SFSpeechRecognizer(locale: Locale(identifier: language)), recognizer.isAvailable else {
            fail(call, code: "network"); return
        }
        do {
            let audio = AVAudioSession.sharedInstance()
            previousAudio = (audio.category, audio.mode, audio.categoryOptions)
            try audio.setCategory(.record, mode: .measurement, options: [.allowBluetoothHFP])
            try audio.setActive(true)
            let engine = AVAudioEngine()
            self.engine = engine
            let format = engine.inputNode.outputFormat(forBus: 0)
            guard format.sampleRate > 0, format.channelCount > 0 else {
                fail(call, code: "audio-capture"); return
            }
            let request = SFSpeechAudioBufferRecognitionRequest()
            request.shouldReportPartialResults = true
            request.taskHint = .dictation
            if #available(iOS 16, *) { request.addsPunctuation = true }
            // Prefer local recognition when available. Unsupported locales retain Apple's normal service.
            if recognizer.supportsOnDeviceRecognition { request.requiresOnDeviceRecognition = true }
            self.request = request
            self.recognizer = recognizer
            var lastMeter = 0.0
            engine.inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
                request.append(buffer)
                let now = ProcessInfo.processInfo.systemUptime
                guard now - lastMeter >= 0.065, let samples = buffer.floatChannelData?[0], buffer.frameLength > 0 else { return }
                lastMeter = now
                var sum: Float = 0
                for i in 0..<Int(buffer.frameLength) { sum += samples[i] * samples[i] }
                let level = min(1, sqrt(sum / Float(buffer.frameLength)) * 7)
                DispatchQueue.main.async {
                    guard self?.sessionID == id, self?.stopping == false else { return }
                    self?.emit(["type": "level", "level": level])
                }
            }
            hasTap = true
            task = recognizer.recognitionTask(with: request) { [weak self] result, error in
                DispatchQueue.main.async {
                    guard let self, self.sessionID == id else { return }
                    if let result {
                        self.emit(["type": "transcript", "text": result.bestTranscription.formattedString])
                        if result.isFinal { self.finish(); return }
                    }
                    if error != nil {
                        if !self.stopping { self.emit(["type": "error", "code": "interrupted"]) }
                        self.finish()
                    }
                }
            }
            engine.prepare()
            try engine.start()
            stopping = false
            emit(["type": "started"])
            maximumTimer = Timer.scheduledTimer(withTimeInterval: 60, repeats: false) { [weak self] _ in self?.stopGracefully() }
            call.resolve()
        } catch {
            fail(call, code: "audio-capture")
        }
    }

    @objc public func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard call.getString("sessionId") == self.sessionID else { call.resolve(); return }
            if call.getBool("cancel") == true { self.finish() }
            else { self.stopGracefully() }
            call.resolve()
        }
    }
    private func fail(_ call: CAPPluginCall, code: String) {
        emit(["type": "error", "code": code])
        finish()
        call.resolve()
    }
    private func stopAudio() {
        engine?.stop()
        if hasTap { engine?.inputNode.removeTap(onBus: 0); hasTap = false }
        request?.endAudio()
    }
    private func stopGracefully() {
        guard sessionID != nil, !stopping else { return }
        stopping = true
        stopAudio()
        finishTimer = Timer.scheduledTimer(withTimeInterval: 4, repeats: false) { [weak self] _ in self?.finish() }
    }
    private func interrupt() {
        guard sessionID != nil else { return }
        emit(["type": "error", "code": "interrupted"])
        finish()
    }
    private func emit(_ fields: [String: Any]) {
        guard let id = sessionID else { return }
        var payload = fields; payload["sessionId"] = id
        notifyListeners("voiceInput", data: payload)
    }
    private func finish() {
        guard let id = sessionID else { return }
        sessionID = nil // Invalidate callbacks before cancelling Apple's recognition task.
        finishTimer?.invalidate(); finishTimer = nil
        maximumTimer?.invalidate(); maximumTimer = nil
        stopAudio()
        task?.cancel(); task = nil
        request = nil; recognizer = nil; engine = nil; stopping = false
        if let previous = previousAudio {
            let audio = AVAudioSession.sharedInstance()
            try? audio.setActive(false, options: .notifyOthersOnDeactivation)
            try? audio.setCategory(previous.0, mode: previous.1, options: previous.2)
            previousAudio = nil
        }
        notifyListeners("voiceInput", data: ["sessionId": id, "type": "ended"])
    }
}
