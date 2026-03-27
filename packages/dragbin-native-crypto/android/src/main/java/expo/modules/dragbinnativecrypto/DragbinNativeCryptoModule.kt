package expo.modules.dragbinnativecrypto

import android.util.Base64
import de.mkammerer.argon2.Argon2Factory
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.bouncycastle.pqc.crypto.crystalskyber.KyberKEMExtractor
import org.bouncycastle.pqc.crypto.crystalskyber.KyberKEMGenerator
import org.bouncycastle.pqc.crypto.crystalskyber.KyberKeyGenerationParameters
import org.bouncycastle.pqc.crypto.crystalskyber.KyberKeyPairGenerator
import org.bouncycastle.pqc.crypto.crystalskyber.KyberParameters
import org.bouncycastle.pqc.crypto.crystalskyber.KyberPrivateKeyParameters
import org.bouncycastle.pqc.crypto.crystalskyber.KyberPublicKeyParameters
import java.security.SecureRandom

class DragbinNativeCryptoModule : Module() {

    private val random = SecureRandom()

    override fun definition() = ModuleDefinition {
        Name("DragbinNativeCrypto")

        AsyncFunction("generateKeyPair") {
            val gen = KyberKeyPairGenerator()
            gen.init(KyberKeyGenerationParameters(random, KyberParameters.kyber1024))
            val keyPair = gen.generateKeyPair()

            val pub = (keyPair.public as KyberPublicKeyParameters).publicKey
            val priv = (keyPair.private as KyberPrivateKeyParameters).privateKey

            mapOf(
                "publicKey"  to Base64.encodeToString(pub, Base64.NO_WRAP),
                "privateKey" to Base64.encodeToString(priv, Base64.NO_WRAP),
            )
        }

        AsyncFunction("encapsulate") { publicKeyB64: String ->
            val pubBytes = Base64.decode(publicKeyB64, Base64.NO_WRAP)
            val pubParams = KyberPublicKeyParameters(KyberParameters.kyber1024, pubBytes)

            val kemGen = KyberKEMGenerator(random)
            val enc = kemGen.generateEncapsulated(pubParams)

            mapOf(
                "ciphertext" to Base64.encodeToString(enc.encapsulation, Base64.NO_WRAP),
                "secret"     to Base64.encodeToString(enc.secret,        Base64.NO_WRAP),
            )
        }

        AsyncFunction("decapsulate") { ciphertextB64: String, privateKeyB64: String ->
            val ctBytes  = Base64.decode(ciphertextB64,  Base64.NO_WRAP)
            val skBytes  = Base64.decode(privateKeyB64,  Base64.NO_WRAP)
            val privParams = KyberPrivateKeyParameters(KyberParameters.kyber1024, skBytes)

            val extractor = KyberKEMExtractor(privParams)
            val secret = extractor.extractSecret(ctBytes)

            Base64.encodeToString(secret, Base64.NO_WRAP)
        }

        AsyncFunction("argon2id") { password: String, saltB64: String ->
            val saltBytes = Base64.decode(saltB64, Base64.NO_WRAP)
            val argon2 = Argon2Factory.createAdvanced(Argon2Factory.Argon2Types.ARGON2id)

            val hash = argon2.rawHash(
                3,      // iterations  — matches @dragbin/crypto
                65536,  // memory KB (64 MB)  — matches @dragbin/crypto
                4,      // parallelism  — matches @dragbin/crypto
                password.toByteArray(Charsets.UTF_8),
                saltBytes,
            )

            Base64.encodeToString(hash, Base64.NO_WRAP)
        }
    }
}
