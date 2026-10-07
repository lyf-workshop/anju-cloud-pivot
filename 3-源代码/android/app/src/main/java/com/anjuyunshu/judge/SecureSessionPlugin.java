package com.anjuyunshu.judge;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import org.json.JSONObject;

@CapacitorPlugin(name = "SecureSession")
public class SecureSessionPlugin extends Plugin {
    private static final String KEY_ALIAS = "anju_judge_session_key_v1";
    private static final String PREFS = "anju_secure_session_v1";
    private static final String TRANSFORMATION = "AES/GCM/NoPadding";

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private String validatedKey(PluginCall call) {
        String key = call.getString("key");
        if (key == null || !key.matches("[A-Za-z0-9_-]{1,80}")) {
            call.reject("Invalid storage key");
            return null;
        }
        return key;
    }

    private SecretKey encryptionKey() throws Exception {
        KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
        keyStore.load(null);
        if (keyStore.containsAlias(KEY_ALIAS)) {
            return (SecretKey) keyStore.getKey(KEY_ALIAS, null);
        }
        KeyGenerator generator = KeyGenerator.getInstance(
            KeyProperties.KEY_ALGORITHM_AES,
            "AndroidKeyStore"
        );
        generator.init(
            new KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true)
                .build()
        );
        return generator.generateKey();
    }

    @PluginMethod
    public void set(PluginCall call) {
        String key = validatedKey(call);
        String value = call.getString("value");
        if (key == null) return;
        if (value == null || value.length() > 20000) {
            call.reject("Invalid secure storage value");
            return;
        }
        try {
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.ENCRYPT_MODE, encryptionKey());
            String encrypted = Base64.encodeToString(
                cipher.doFinal(value.getBytes(java.nio.charset.StandardCharsets.UTF_8)),
                Base64.NO_WRAP
            );
            String iv = Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP);
            boolean saved = prefs().edit()
                .putString(key + ".data", encrypted)
                .putString(key + ".iv", iv)
                .commit();
            if (!saved) throw new IllegalStateException("Secure preferences commit failed");
            call.resolve();
        } catch (Exception error) {
            call.reject("Unable to protect the local session", error);
        }
    }

    @PluginMethod
    public void get(PluginCall call) {
        String key = validatedKey(call);
        if (key == null) return;
        String encrypted = prefs().getString(key + ".data", null);
        String iv = prefs().getString(key + ".iv", null);
        JSObject result = new JSObject();
        if (encrypted == null || iv == null) {
            result.put("value", JSONObject.NULL);
            call.resolve(result);
            return;
        }
        try {
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(
                Cipher.DECRYPT_MODE,
                encryptionKey(),
                new GCMParameterSpec(128, Base64.decode(iv, Base64.NO_WRAP))
            );
            String value = new String(
                cipher.doFinal(Base64.decode(encrypted, Base64.NO_WRAP)),
                java.nio.charset.StandardCharsets.UTF_8
            );
            result.put("value", value);
            call.resolve(result);
        } catch (Exception error) {
            prefs().edit().remove(key + ".data").remove(key + ".iv").commit();
            call.reject("Unable to restore the protected local session", error);
        }
    }

    @PluginMethod
    public void remove(PluginCall call) {
        String key = validatedKey(call);
        if (key == null) return;
        prefs().edit().remove(key + ".data").remove(key + ".iv").commit();
        call.resolve();
    }
}
