import ExpoModulesCore

public class DragbinNativeCryptoModule: Module {
    public func definition() -> ModuleDefinition {
        Name("DragbinNativeCrypto")

        AsyncFunction("generateKeyPair") { () throws -> [String: String] in
            var err: NSError?
            guard let result = KyberBridge.generateKeyPair(error: &err) else {
                throw err ?? NSError(domain: "DragbinNativeCrypto", code: -1)
            }
            return result as! [String: String]
        }

        AsyncFunction("encapsulate") { (publicKeyB64: String) throws -> [String: String] in
            var err: NSError?
            guard let result = KyberBridge.encapsulate(publicKeyB64, error: &err) else {
                throw err ?? NSError(domain: "DragbinNativeCrypto", code: -1)
            }
            return result as! [String: String]
        }

        AsyncFunction("decapsulate") { (ciphertextB64: String, privateKeyB64: String) throws -> String in
            var err: NSError?
            guard let secret = KyberBridge.decapsulate(ciphertextB64, privateKey: privateKeyB64, error: &err) else {
                throw err ?? NSError(domain: "DragbinNativeCrypto", code: -1)
            }
            return secret
        }

        AsyncFunction("argon2id") { (password: String, saltB64: String) throws -> String in
            var err: NSError?
            guard let hash = Argon2Bridge.hash(password, saltB64: saltB64, error: &err) else {
                throw err ?? NSError(domain: "DragbinNativeCrypto", code: -1)
            }
            return hash
        }
    }
}
