package at.selfmade.app;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.text.InputType;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.SslErrorHandler;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.ProgressBar;
import android.widget.Toast;

import java.util.ArrayList;
import java.util.List;

public final class MainActivity extends Activity {
    private static final String PREFS = "selfmade_android";
    private static final String KEY_URL = "app_url";
    private static final String KEY_CONFIGURED = "configured";
    private static final String DEFAULT_URL = "https://selfmade-v3.vercel.app";
    private static final int CAMERA_PERMISSION_REQUEST = 501;
    private static final int FILE_CHOOSER_REQUEST = 502;

    private WebView webView;
    private ProgressBar progressBar;
    private SharedPreferences preferences;
    private PermissionRequest pendingPermissionRequest;
    private ValueCallback<Uri[]> fileChooserCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getWindow().setStatusBarColor(Color.rgb(240, 238, 233));
        getWindow().setNavigationBarColor(Color.rgb(240, 238, 233));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
            );
        }

        preferences = getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        buildInterface();
        configureWebView();

        if (preferences.getBoolean(KEY_CONFIGURED, false)) {
            loadConfiguredUrl();
        } else {
            showUrlDialog(true);
        }
    }

    private void buildInterface() {
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(240, 238, 233));

        webView = new WebView(this);
        root.addView(webView, new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        ));

        progressBar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progressBar.setMax(100);
        progressBar.setVisibility(View.GONE);
        FrameLayout.LayoutParams progressParams = new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            dp(3)
        );
        progressParams.gravity = android.view.Gravity.TOP;
        root.addView(progressBar, progressParams);

        setContentView(root);
    }

    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccess(false);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setLoadWithOverviewMode(false);
        settings.setUseWideViewPort(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setUserAgentString(settings.getUserAgentString() + " SelfmadeAndroid/19.1");

        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, true);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WebView.setSafeBrowsingEnabled(true);
        }
        WebView.setWebContentsDebuggingEnabled(false);

        webView.addJavascriptInterface(new AndroidBridge(), "Android");
        webView.setOnLongClickListener(view -> {
            showUrlDialog(false);
            return true;
        });

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return handleExternalUrl(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return handleExternalUrl(Uri.parse(url));
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                progressBar.setVisibility(View.GONE);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                super.onReceivedError(view, request, error);
                if (request.isForMainFrame()) {
                    showOfflinePage();
                }
            }

            @Override
            public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse errorResponse) {
                super.onReceivedHttpError(view, request, errorResponse);
                if (request.isForMainFrame() && errorResponse.getStatusCode() >= 400) {
                    showOfflinePage();
                }
            }

            @Override
            public void onReceivedSslError(WebView view, SslErrorHandler handler, android.net.http.SslError error) {
                handler.cancel();
                showOfflinePage();
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                progressBar.setProgress(newProgress);
                progressBar.setVisibility(newProgress >= 100 ? View.GONE : View.VISIBLE);
            }

            @Override
            public void onPermissionRequest(PermissionRequest request) {
                runOnUiThread(() -> handleWebPermissionRequest(request));
            }

            @Override
            public boolean onShowFileChooser(
                WebView webView,
                ValueCallback<Uri[]> filePathCallback,
                FileChooserParams fileChooserParams
            ) {
                if (fileChooserCallback != null) {
                    fileChooserCallback.onReceiveValue(null);
                }
                fileChooserCallback = filePathCallback;

                Intent intent;
                try {
                    intent = fileChooserParams.createIntent();
                } catch (Exception ignored) {
                    intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.setType("image/*");
                }

                try {
                    startActivityForResult(intent, FILE_CHOOSER_REQUEST);
                    return true;
                } catch (ActivityNotFoundException error) {
                    fileChooserCallback = null;
                    Toast.makeText(MainActivity.this, "Keine passende Datei-App gefunden.", Toast.LENGTH_LONG).show();
                    return false;
                }
            }
        });

        webView.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> {
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
            } catch (ActivityNotFoundException error) {
                Toast.makeText(this, "Download konnte nicht geöffnet werden.", Toast.LENGTH_LONG).show();
            }
        });
    }

    private boolean handleExternalUrl(Uri uri) {
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase();
        if (scheme.equals("http") || scheme.equals("https")) {
            Uri configured = Uri.parse(getConfiguredUrl());
            String configuredHost = configured.getHost();
            if (configuredHost != null && configuredHost.equalsIgnoreCase(uri.getHost())) {
                return false;
            }
        }

        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (ActivityNotFoundException error) {
            Toast.makeText(this, "Dieser Link kann nicht geöffnet werden.", Toast.LENGTH_LONG).show();
        }
        return true;
    }

    private void handleWebPermissionRequest(PermissionRequest request) {
        boolean requestsCamera = false;
        for (String resource : request.getResources()) {
            if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)) {
                requestsCamera = true;
                break;
            }
        }

        if (!requestsCamera) {
            request.deny();
            return;
        }

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M ||
            checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
            request.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
            return;
        }

        pendingPermissionRequest = request;
        requestPermissions(new String[]{Manifest.permission.CAMERA}, CAMERA_PERMISSION_REQUEST);
    }

    private void showUrlDialog(boolean firstLaunch) {
        EditText input = new EditText(this);
        input.setSingleLine(true);
        input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        input.setText(getConfiguredUrl());
        input.setSelection(input.getText().length());
        int padding = dp(20);
        input.setPadding(padding, dp(12), padding, dp(12));

        AlertDialog dialog = new AlertDialog.Builder(this)
            .setTitle("Selfmade-Webadresse")
            .setMessage(firstLaunch
                ? "Die Android-App öffnet deine veröffentlichte Selfmade-Web-App. Prüfe die Adresse und tippe auf „App öffnen“."
                : "Hier kannst du die veröffentlichte App-Adresse ändern. Diese Ansicht lässt sich später durch langes Drücken erneut öffnen.")
            .setView(input)
            .setNegativeButton(firstLaunch ? "Standard verwenden" : "Abbrechen", null)
            .setPositiveButton("App öffnen", null)
            .create();

        dialog.setOnShowListener(ignored -> {
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(view -> {
                String normalized = normalizeUrl(input.getText().toString());
                if (normalized == null) {
                    input.setError("Bitte eine gültige Webadresse eingeben.");
                    return;
                }
                preferences.edit()
                    .putString(KEY_URL, normalized)
                    .putBoolean(KEY_CONFIGURED, true)
                    .apply();
                dialog.dismiss();
                webView.loadUrl(normalized);
            });

            dialog.getButton(AlertDialog.BUTTON_NEGATIVE).setOnClickListener(view -> {
                dialog.dismiss();
                if (firstLaunch) {
                    preferences.edit()
                        .putString(KEY_URL, DEFAULT_URL)
                        .putBoolean(KEY_CONFIGURED, true)
                        .apply();
                    webView.loadUrl(DEFAULT_URL);
                }
            });
        });
        dialog.setCancelable(!firstLaunch);
        dialog.show();
    }

    private String normalizeUrl(String raw) {
        String value = raw == null ? "" : raw.trim();
        if (value.isEmpty()) return null;
        if (!value.startsWith("https://") && !value.startsWith("http://")) {
            value = "https://" + value;
        }
        Uri uri = Uri.parse(value);
        if (uri.getHost() == null || uri.getHost().trim().isEmpty()) return null;
        return uri.buildUpon().fragment(null).build().toString();
    }

    private String getConfiguredUrl() {
        return preferences.getString(KEY_URL, DEFAULT_URL);
    }

    private void loadConfiguredUrl() {
        webView.loadUrl(getConfiguredUrl());
    }

    private void showOfflinePage() {
        String html = "<!doctype html><html lang='de'><head><meta name='viewport' content='width=device-width,initial-scale=1'>" +
            "<style>body{margin:0;background:#f0eee9;color:#17171b;font-family:system-ui,-apple-system,sans-serif;display:grid;place-items:center;min-height:100vh;padding:24px;box-sizing:border-box}" +
            ".card{max-width:420px;background:#fff;border:1px solid #ddd8cf;border-radius:24px;padding:28px;box-shadow:0 12px 40px #00000012;text-align:center}" +
            "h1{font-size:24px;margin:0 0 10px}p{color:#666;line-height:1.5}button{border:0;border-radius:14px;background:#4361ee;color:white;font-weight:750;padding:14px 18px;font-size:16px;width:100%;margin-top:10px}</style></head>" +
            "<body><main class='card'><h1>Selfmade ist nicht erreichbar</h1><p>Prüfe deine Internetverbindung und die veröffentlichte Webadresse.</p>" +
            "<button onclick='location.reload()'>Erneut versuchen</button><button onclick='Android.openSettings()'>Webadresse ändern</button></main></body></html>";
        webView.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null);
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != FILE_CHOOSER_REQUEST || fileChooserCallback == null) return;
        Uri[] result = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
        fileChooserCallback.onReceiveValue(result);
        fileChooserCallback = null;
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != CAMERA_PERMISSION_REQUEST || pendingPermissionRequest == null) return;

        if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            pendingPermissionRequest.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
        } else {
            pendingPermissionRequest.deny();
            Toast.makeText(this, "Kamerazugriff wurde nicht erlaubt.", Toast.LENGTH_LONG).show();
        }
        pendingPermissionRequest = null;
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.stopLoading();
            webView.removeJavascriptInterface("Android");
            webView.destroy();
        }
        super.onDestroy();
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private final class AndroidBridge {
        @JavascriptInterface
        public void openSettings() {
            runOnUiThread(() -> showUrlDialog(false));
        }

        @JavascriptInterface
        public void openAppSettings() {
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            intent.setData(Uri.parse("package:" + getPackageName()));
            startActivity(intent);
        }
    }
}
