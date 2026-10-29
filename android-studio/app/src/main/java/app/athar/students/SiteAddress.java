package app.athar.students;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Locale;

/** Validates the public website address without ever accepting credentials. */
public final class SiteAddress {
    private SiteAddress() {}

    public static String normalize(String input) {
        if (input == null || input.trim().isEmpty()) return null;
        try {
            URI uri = new URI(input.trim()).normalize();
            String host = uri.getHost();
            if (!"https".equalsIgnoreCase(uri.getScheme()) || host == null
                    || uri.getRawUserInfo() != null || uri.getRawQuery() != null
                    || uri.getRawFragment() != null || (uri.getPort() != -1 && uri.getPort() != 443)) {
                return null;
            }
            host = host.toLowerCase(Locale.ROOT);
            // Public DNS names only: reject local names and IP-literal addresses.
            if (!host.contains(".") || host.endsWith(".") || host.endsWith(".local")
                    || host.endsWith(".localhost") || host.contains(":")
                    || host.matches("[0-9.]+") || !host.matches("[a-z0-9.-]+")) {
                return null;
            }
            for (String label : host.split("\\.")) {
                if (label.isEmpty() || label.length() > 63
                        || label.startsWith("-") || label.endsWith("-")) return null;
            }
            String path = uri.getRawPath();
            return "https://" + host + (path == null || path.isEmpty() ? "/" : path);
        } catch (URISyntaxException error) {
            return null;
        }
    }

    public static boolean isDevelopment(String url) {
        String host = URI.create(url).getHost();
        return host.endsWith(".replit.dev");
    }
}
