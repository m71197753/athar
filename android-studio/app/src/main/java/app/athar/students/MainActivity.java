package app.athar.students;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import androidx.browser.customtabs.CustomTabsIntent;

/**
 * An honest browser-backed Android shell, not a second copy of student data.
 * Custom Tabs preserves the real browser's login, cookies and notification
 * permissions. No WebView JavaScript bridge or native credential storage.
 */
public final class MainActivity extends Activity {
    private static final int INK = Color.rgb(25, 45, 66);
    private static final int TEAL = Color.rgb(35, 124, 131);
    private LinearLayout content;
    private TextView address;
    private TextView development;
    private SharedPreferences preferences;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        preferences = getSharedPreferences("athar_public_settings", MODE_PRIVATE);

        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setGravity(Gravity.CENTER_HORIZONTAL);
        content.setPadding(dp(28), dp(40), dp(28), dp(32));
        content.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
        scroll.addView(content);

        if (Build.VERSION.SDK_INT >= 35) {
            final int topPadding = dp(40);
            final int bottomPadding = dp(32);
            scroll.setOnApplyWindowInsetsListener((view, insets) -> {
                android.graphics.Insets bars = insets.getInsets(
                    android.view.WindowInsets.Type.systemBars()
                        | android.view.WindowInsets.Type.displayCutout());
                content.setPadding(dp(28) + bars.left, topPadding + bars.top,
                    dp(28) + bars.right, bottomPadding + bars.bottom);
                return insets;
            });
        }

        ImageView logo = new ImageView(this);
        logo.setImageResource(R.drawable.athar_icon);
        logo.setContentDescription(getString(R.string.app_name));
        LinearLayout.LayoutParams logoSize = new LinearLayout.LayoutParams(dp(112), dp(112));
        logoSize.bottomMargin = dp(20);
        content.addView(logo, logoSize);
        text(R.string.tagline, 14, TEAL);
        text(R.string.intro, 26, INK);
        text(R.string.description, 16, INK);

        address = text("", 14, INK);
        address.setTextDirection(View.TEXT_DIRECTION_LTR);
        address.setTextIsSelectable(true);
        development = text(R.string.development_notice, 14, Color.rgb(136, 73, 19));

        Button open = new Button(this);
        open.setText(R.string.open_app);
        open.setOnClickListener(view -> openWebsite());
        content.addView(open, buttonSize());

        Button configure = new Button(this);
        configure.setText(R.string.configure);
        configure.setOnClickListener(view -> configureAddress());
        content.addView(configure, buttonSize());

        text(R.string.browser_notice, 13, INK);
        text(R.string.privacy, 13, INK);
        setContentView(scroll);
        refreshAddress();
    }

    private String siteUrl() {
        return SiteAddress.normalize(preferences.getString("website", BuildConfig.APP_URL));
    }

    private void refreshAddress() {
        String url = siteUrl();
        address.setText(url == null ? getString(R.string.not_configured)
            : getString(R.string.configured_url, url));
        development.setVisibility(url != null && SiteAddress.isDevelopment(url)
            ? View.VISIBLE : View.GONE);
    }

    private void openWebsite() {
        String url = siteUrl();
        if (url == null) {
            configureAddress();
            return;
        }
        try {
            CustomTabsIntent tab = new CustomTabsIntent.Builder()
                .setShowTitle(true)
                .setDefaultColorSchemeParams(
                    new androidx.browser.customtabs.CustomTabColorSchemeParams.Builder()
                        .setToolbarColor(TEAL).build())
                .build();
            tab.launchUrl(this, Uri.parse(url));
        } catch (ActivityNotFoundException error) {
            new AlertDialog.Builder(this).setMessage(R.string.browser_missing)
                .setPositiveButton(android.R.string.ok, null).show();
        }
    }

    private void configureAddress() {
        EditText input = new EditText(this);
        input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        input.setSingleLine(true);
        input.setTextDirection(View.TEXT_DIRECTION_LTR);
        input.setHint("https://");
        input.setText(siteUrl() == null ? "" : siteUrl());
        LinearLayout body = new LinearLayout(this);
        body.setOrientation(LinearLayout.VERTICAL);
        body.setPadding(dp(24), dp(8), dp(24), 0);
        TextView help = new TextView(this);
        help.setText(R.string.address_help);
        help.setTextSize(15);
        body.addView(help);
        body.addView(input);
        AlertDialog dialog = new AlertDialog.Builder(this)
            .setTitle(R.string.address_title).setView(body)
            .setNegativeButton(R.string.cancel, null)
            .setPositiveButton(R.string.save, null).create();
        dialog.setOnShowListener(unused -> dialog.getButton(AlertDialog.BUTTON_POSITIVE)
            .setOnClickListener(view -> {
                String url = SiteAddress.normalize(input.getText().toString());
                if (url == null) {
                    input.setError(getString(R.string.address_error));
                    return;
                }
                preferences.edit().putString("website", url).apply();
                refreshAddress();
                dialog.dismiss();
            }));
        dialog.show();
    }

    private TextView text(int resource, int size, int color) {
        return text(getString(resource), size, color);
    }

    private TextView text(String value, int size, int color) {
        TextView text = new TextView(this);
        text.setText(value);
        text.setTextSize(size);
        text.setTextColor(color);
        text.setGravity(Gravity.CENTER);
        text.setPadding(0, dp(8), 0, dp(8));
        content.addView(text, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));
        return text;
    }

    private LinearLayout.LayoutParams buttonSize() {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        params.topMargin = dp(12);
        return params;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
