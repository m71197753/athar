package app.athar.students;

import static org.junit.Assert.*;
import org.junit.Test;

public class SiteAddressTest {
    @Test public void acceptsOnlyPublicHttpsAddresses() {
        assertEquals("https://athar.example/", SiteAddress.normalize("https://athar.example"));
        assertEquals("https://athar.example/students/", SiteAddress.normalize(" https://ATHAR.example:443/students/ "));
        for (String value : new String[] {
            "", "http://athar.example", "javascript:alert(1)", "file:///tmp/a",
            "https://user:password@athar.example", "https://athar.example/?token=secret",
            "https://athar.example/#fragment", "https://127.0.0.1", "https://localhost",
            "https://private.local", "https://[::1]", "https://athar.example:8443",
            "https://-bad.example", "https://bad..example"
        }) assertNull(value, SiteAddress.normalize(value));
    }

    @Test public void identifiesTemporaryPreviewAddresses() {
        assertTrue(SiteAddress.isDevelopment("https://preview.replit.dev/"));
        assertFalse(SiteAddress.isDevelopment("https://athar.example/"));
    }
}
