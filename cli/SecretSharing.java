import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.PBEKeySpec;
import javax.crypto.spec.SecretKeySpec;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;

public class SecretSharing {
    private static final String SALT = "salt"; // Same salt as in JavaScript
    private static final int ITERATIONS = 100000;
    private static final int KEY_LENGTH = 256;

    // Encrypt secret with AES-GCM (no padding, tag appended)
    public static String[] encryptSecret(String secret, String password) throws Exception {
        byte[] salt = SALT.getBytes(StandardCharsets.UTF_8);
        PBEKeySpec spec = new PBEKeySpec(password.toCharArray(), salt, ITERATIONS, KEY_LENGTH);
        javax.crypto.SecretKeyFactory factory = javax.crypto.SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256");
        byte[] key = factory.generateSecret(spec).getEncoded();
        SecretKeySpec secretKey = new SecretKeySpec(key, "AES");

        byte[] iv = new byte[12];
        new SecureRandom().nextBytes(iv);
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        GCMParameterSpec gcmSpec = new GCMParameterSpec(128, iv);
        cipher.init(Cipher.ENCRYPT_MODE, secretKey, gcmSpec);
        byte[] encrypted = cipher.doFinal(secret.getBytes(StandardCharsets.UTF_8));
        return new String[]{Base64.getEncoder().encodeToString(iv), Base64.getEncoder().encodeToString(encrypted)};
    }

    // Decrypt secret with AES-GCM (extract tag from combined data)
    public static String decryptSecret(String encrypted, String iv, String password) throws Exception {
        byte[] salt = SALT.getBytes(StandardCharsets.UTF_8);
        PBEKeySpec spec = new PBEKeySpec(password.toCharArray(), salt, ITERATIONS, KEY_LENGTH);
        javax.crypto.SecretKeyFactory factory = javax.crypto.SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256");
        byte[] key = factory.generateSecret(spec).getEncoded();
        SecretKeySpec secretKey = new SecretKeySpec(key, "AES");

        byte[] encryptedBytes = Base64.getDecoder().decode(encrypted);
        byte[] ivBytes = Base64.getDecoder().decode(iv);
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        GCMParameterSpec gcmSpec = new GCMParameterSpec(128, ivBytes);
        cipher.init(Cipher.DECRYPT_MODE, secretKey, gcmSpec);
        byte[] decrypted = cipher.doFinal(encryptedBytes);
        return new String(decrypted, StandardCharsets.UTF_8);
    }

    // Convert Map to JSON string
    public static String toJson(Map<String, Object> map) {
        StringBuilder json = new StringBuilder("{");
        boolean first = true;
        for (Map.Entry<String, Object> entry : map.entrySet()) {
            if (!first) json.append(",");
            first = false;
            json.append("\"").append(entry.getKey()).append("\":");
            Object value = entry.getValue();
            if (value instanceof String) {
                json.append("\"").append(value).append("\"");
            } else if (value instanceof Boolean) {
                json.append(value);
            } else if (value instanceof Number) {
                json.append(value);
            } else {
                json.append("\"").append(value.toString()).append("\"");
            }
        }
        json.append("}");
        return json.toString();
    }

    // Convert JSON string to Map (basic parsing)
    public static Map<String, Object> fromJson(String json) {
        Map<String, Object> map = new HashMap<>();
        json = json.trim();
        if (!json.startsWith("{") || !json.endsWith("}")) return map;
        json = json.substring(1, json.length() - 1).trim(); // Remove braces
        if (json.isEmpty()) return map;

        String[] pairs = json.split(",(?=([^\"]*\"[^\"]*\")*[^\"]*$)");
        for (String pair : pairs) {
            String[] keyValue = pair.split(":", 2);
            if (keyValue.length != 2) continue;
            String key = keyValue[0].trim().replaceAll("^\"|\"$", "");
            String value = keyValue[1].trim();
            if (value.startsWith("\"") && value.endsWith("\"")) {
                map.put(key, value.substring(1, value.length() - 1));
            } else if (value.equals("true") || value.equals("false")) {
                map.put(key, Boolean.parseBoolean(value));
            } else {
                try {
                    map.put(key, Long.parseLong(value));
                } catch (NumberFormatException e) {
                    map.put(key, value); // Fallback to string if not a number
                }
            }
        }
        return map;
    }

    // Post secret to API
    public static void postSecret(String url, String masterPassword, String secret) throws Exception {
        String[] encryptedData = encryptSecret(secret, masterPassword);
        String iv = encryptedData[0];
        String encrypted = encryptedData[1];

        Map<String, Object> payload = new HashMap<>();
        payload.put("encrypted", encrypted);
        payload.put("iv", iv);
        payload.put("expiry", 86400); // 1 day default
        payload.put("maxAttempts", 3);
        payload.put("isE2EE", true);

        HttpURLConnection conn = (HttpURLConnection) new URL(url + "/api/create").openConnection();
        conn.setRequestMethod("POST");
        conn.setRequestProperty("Content-Type", "application/json");
        conn.setDoOutput(true);
        try (OutputStream os = conn.getOutputStream()) {
            os.write(toJson(payload).getBytes(StandardCharsets.UTF_8));
        }

        try (BufferedReader in = new BufferedReader(new InputStreamReader(conn.getInputStream()))) {
            String response = in.readLine();
            Map<String, Object> json = fromJson(response);
            if ((Boolean) json.get("success")) {
                String link = url + "/retrieve.html?code=" + json.get("code");
                System.out.println("Secret created!\nLink: " + link + "\nOTP: " + json.get("otp"));
            } else {
                System.out.println("Error: " + json.get("message"));
            }
        }
    }

    // Retrieve and decrypt secret
    public static void retrieveSecret(String url, String masterPassword, String code, String otp) throws Exception {
        HttpURLConnection conn = (HttpURLConnection) new URL(url + "/api/retrieve?code=" + code + "&otp=" + otp).openConnection();
        conn.setRequestMethod("GET");

        try (BufferedReader in = new BufferedReader(new InputStreamReader(conn.getInputStream()))) {
            String response = in.readLine();
            Map<String, Object> json = fromJson(response);
            if ((Boolean) json.get("success")) {
                String decrypted = decryptSecret((String) json.get("encrypted"), (String) json.get("iv"), masterPassword);
                System.out.println("Decrypted Secret: " + decrypted);
            } else {
                System.out.println("Error: " + json.get("message"));
            }
        }
    }

    public static void main(String[] args) throws Exception {
        BufferedReader reader = new BufferedReader(new InputStreamReader(System.in));
        String url = args.length > 0 ? args[0] : prompt(reader, "Enter API URL (e.g., https://your-app.pages.dev): ");
        String masterPassword = args.length > 1 ? args[1] : prompt(reader, "Enter master password: ");
        System.out.print("Choose action (1 = Post Secret, 2 = Retrieve Secret): ");
        String action = reader.readLine();

        if (action.equals("1")) {
            String secret = args.length > 2 ? args[2] : prompt(reader, "Enter secret: ");
            postSecret(url, masterPassword, secret);
        } else if (action.equals("2")) {
            String code = args.length > 2 ? args[2] : prompt(reader, "Enter secret code: ");
            String otp = args.length > 3 ? args[3] : prompt(reader, "Enter OTP: ");
            retrieveSecret(url, masterPassword, code, otp);
        } else {
            System.out.println("Invalid action. Use 1 or 2.");
        }
    }

    private static String prompt(BufferedReader reader, String message) throws Exception {
        System.out.print(message);
        return reader.readLine();
    }
}