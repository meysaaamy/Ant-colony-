.class public Lcom/app/antcolony/MainActivity;
.super Landroid/app/Activity;
.source "MainActivity.java"


# instance fields
.field private webView:Landroid/webkit/WebView;


# direct methods
.method public constructor <init>()V
    .registers 1

    .line 20
    invoke-direct {p0}, Landroid/app/Activity;-><init>()V

    return-void
.end method


# virtual methods
.method public onBackPressed()V
    .registers 2

    .line 106
    iget-object v0, p0, Lcom/app/antcolony/MainActivity;->webView:Landroid/webkit/WebView;

    if-eqz v0, :cond_12

    iget-object v0, p0, Lcom/app/antcolony/MainActivity;->webView:Landroid/webkit/WebView;

    invoke-virtual {v0}, Landroid/webkit/WebView;->canGoBack()Z

    move-result v0

    if-eqz v0, :cond_12

    .line 107
    iget-object v0, p0, Lcom/app/antcolony/MainActivity;->webView:Landroid/webkit/WebView;

    invoke-virtual {v0}, Landroid/webkit/WebView;->goBack()V

    .line 108
    goto :goto_15

    .line 109
    :cond_12
    invoke-super {p0}, Landroid/app/Activity;->onBackPressed()V

    .line 111
    :goto_15
    return-void
.end method

.method protected onCreate(Landroid/os/Bundle;)V
    .registers 8

    .line 25
    invoke-super {p0, p1}, Landroid/app/Activity;->onCreate(Landroid/os/Bundle;)V

    invoke-direct {p0}, Lcom/app/antcolony/MainActivity;->applyChrome()V

    .line 27
    :try_start_3
    new-instance p1, Landroid/webkit/WebView;

    invoke-direct {p1, p0}, Landroid/webkit/WebView;-><init>(Landroid/content/Context;)V

    iput-object p1, p0, Lcom/app/antcolony/MainActivity;->webView:Landroid/webkit/WebView;

    const v0, -16579318

    invoke-virtual {p1, v0}, Landroid/webkit/WebView;->setBackgroundColor(I)V

    .line 28
    iget-object p1, p0, Lcom/app/antcolony/MainActivity;->webView:Landroid/webkit/WebView;

    invoke-virtual {p1}, Landroid/webkit/WebView;->getSettings()Landroid/webkit/WebSettings;

    move-result-object p1

    .line 30
    const/4 v0, 0x1

    invoke-virtual {p1, v0}, Landroid/webkit/WebSettings;->setJavaScriptEnabled(Z)V

    .line 31
    invoke-virtual {p1, v0}, Landroid/webkit/WebSettings;->setDomStorageEnabled(Z)V

    .line 32
    invoke-virtual {p1, v0}, Landroid/webkit/WebSettings;->setDatabaseEnabled(Z)V

    .line 33
    invoke-virtual {p1, v0}, Landroid/webkit/WebSettings;->setAllowFileAccess(Z)V

    .line 34
    invoke-virtual {p1, v0}, Landroid/webkit/WebSettings;->setAllowContentAccess(Z)V

    .line 35
    invoke-virtual {p1, v0}, Landroid/webkit/WebSettings;->setAllowFileAccessFromFileURLs(Z)V

    .line 36
    invoke-virtual {p1, v0}, Landroid/webkit/WebSettings;->setAllowUniversalAccessFromFileURLs(Z)V

    .line 37
    const/4 v1, 0x0

    invoke-virtual {p1, v1}, Landroid/webkit/WebSettings;->setMediaPlaybackRequiresUserGesture(Z)V

    .line 38
    invoke-virtual {p1, v0}, Landroid/webkit/WebSettings;->setJavaScriptCanOpenWindowsAutomatically(Z)V

    .line 39
    invoke-virtual {p1, v1}, Landroid/webkit/WebSettings;->setSupportMultipleWindows(Z)V

    .line 40
    invoke-virtual {p1, v1}, Landroid/webkit/WebSettings;->setBuiltInZoomControls(Z)V

    .line 41
    invoke-virtual {p1, v1}, Landroid/webkit/WebSettings;->setDisplayZoomControls(Z)V

    .line 43
    invoke-static {}, Landroid/webkit/CookieManager;->getInstance()Landroid/webkit/CookieManager;

    move-result-object p1

    .line 44
    invoke-virtual {p1, v0}, Landroid/webkit/CookieManager;->setAcceptCookie(Z)V

    .line 45
    iget-object v2, p0, Lcom/app/antcolony/MainActivity;->webView:Landroid/webkit/WebView;

    invoke-virtual {p1, v2, v0}, Landroid/webkit/CookieManager;->setAcceptThirdPartyCookies(Landroid/webkit/WebView;Z)V

    .line 47
    iget-object p1, p0, Lcom/app/antcolony/MainActivity;->webView:Landroid/webkit/WebView;

    new-instance v0, Lcom/app/antcolony/MainActivity$1;

    invoke-direct {v0, p0}, Lcom/app/antcolony/MainActivity$1;-><init>(Lcom/app/antcolony/MainActivity;)V

    invoke-virtual {p1, v0}, Landroid/webkit/WebView;->setWebViewClient(Landroid/webkit/WebViewClient;)V

    .line 58
    iget-object p1, p0, Lcom/app/antcolony/MainActivity;->webView:Landroid/webkit/WebView;

    new-instance v0, Lcom/app/antcolony/MainActivity$2;

    invoke-direct {v0, p0}, Lcom/app/antcolony/MainActivity$2;-><init>(Lcom/app/antcolony/MainActivity;)V

    invoke-virtual {p1, v0}, Landroid/webkit/WebView;->setWebChromeClient(Landroid/webkit/WebChromeClient;)V

    .line 77
    iget-object p1, p0, Lcom/app/antcolony/MainActivity;->webView:Landroid/webkit/WebView;

    const-string v0, "file:///android_asset/www/index.html"

    invoke-virtual {p1, v0}, Landroid/webkit/WebView;->loadUrl(Ljava/lang/String;)V

    .line 78
    iget-object p1, p0, Lcom/app/antcolony/MainActivity;->webView:Landroid/webkit/WebView;

    invoke-virtual {p0, p1}, Lcom/app/antcolony/MainActivity;->setContentView(Landroid/view/View;)V

    .line 81
    sget p1, Landroid/os/Build$VERSION;->SDK_INT:I
    :try_end_64
    .catchall {:try_start_3 .. :try_end_64} :catchall_aa

    const/16 v0, 0x17

    if-lt p1, v0, :cond_ae

    .line 83
    :try_start_68
    invoke-virtual {p0}, Lcom/app/antcolony/MainActivity;->getPackageManager()Landroid/content/pm/PackageManager;

    move-result-object p1

    invoke-virtual {p0}, Lcom/app/antcolony/MainActivity;->getPackageName()Ljava/lang/String;

    move-result-object v0

    const/16 v2, 0x1000

    invoke-virtual {p1, v0, v2}, Landroid/content/pm/PackageManager;->getPackageInfo(Ljava/lang/String;I)Landroid/content/pm/PackageInfo;

    move-result-object p1

    iget-object p1, p1, Landroid/content/pm/PackageInfo;->requestedPermissions:[Ljava/lang/String;

    .line 84
    if-eqz p1, :cond_ae

    array-length v0, p1

    if-lez v0, :cond_ae

    .line 85
    new-instance v0, Ljava/util/ArrayList;

    invoke-direct {v0}, Ljava/util/ArrayList;-><init>()V

    .line 86
    array-length v2, p1

    const/4 v3, 0x0

    :goto_84
    if-lt v3, v2, :cond_9a

    .line 91
    invoke-virtual {v0}, Ljava/util/ArrayList;->isEmpty()Z

    move-result p1

    if-nez p1, :cond_ae

    .line 92
    new-array p1, v1, [Ljava/lang/String;

    invoke-virtual {v0, p1}, Ljava/util/ArrayList;->toArray([Ljava/lang/Object;)[Ljava/lang/Object;

    move-result-object p1

    check-cast p1, [Ljava/lang/String;

    const/16 v0, 0x65

    invoke-virtual {p0, p1, v0}, Lcom/app/antcolony/MainActivity;->requestPermissions([Ljava/lang/String;I)V

    .line 95
    goto :goto_ae

    .line 86
    :cond_9a
    aget-object v4, p1, v3

    .line 87
    invoke-virtual {p0, v4}, Lcom/app/antcolony/MainActivity;->checkSelfPermission(Ljava/lang/String;)I

    move-result v5

    if-eqz v5, :cond_a5

    .line 88
    invoke-virtual {v0, v4}, Ljava/util/ArrayList;->add(Ljava/lang/Object;)Z
    :try_end_a5
    .catchall {:try_start_68 .. :try_end_a5} :catchall_a8

    .line 86
    :cond_a5
    add-int/lit8 v3, v3, 0x1

    goto :goto_84

    .line 95
    :catchall_a8
    move-exception p1

    .line 99
    goto :goto_ae

    :catchall_aa
    move-exception p1

    .line 100
    invoke-virtual {p1}, Ljava/lang/Throwable;->printStackTrace()V

    .line 102
    :cond_ae
    :goto_ae
    return-void
.end method

# virtual methods
.method private applyChrome()V
    .registers 4

    invoke-virtual {p0}, Landroid/app/Activity;->getWindow()Landroid/view/Window;

    move-result-object v0

    const/16 v1, 0x80

    invoke-virtual {v0, v1}, Landroid/view/Window;->addFlags(I)V

    invoke-virtual {v0}, Landroid/view/Window;->getDecorView()Landroid/view/View;

    move-result-object v0

    const/16 v1, 0x1706

    invoke-virtual {v0, v1}, Landroid/view/View;->setSystemUiVisibility(I)V

    iget-object v0, p0, Lcom/app/antcolony/MainActivity;->webView:Landroid/webkit/WebView;

    if-eqz v0, :cond_keep

    const v1, -16579318

    invoke-virtual {v0, v1}, Landroid/webkit/WebView;->setBackgroundColor(I)V

    :cond_keep
    return-void
.end method

.method protected onDestroy()V
    .registers 2

    .line 131
    iget-object v0, p0, Lcom/app/antcolony/MainActivity;->webView:Landroid/webkit/WebView;

    if-eqz v0, :cond_9

    .line 132
    iget-object v0, p0, Lcom/app/antcolony/MainActivity;->webView:Landroid/webkit/WebView;

    invoke-virtual {v0}, Landroid/webkit/WebView;->destroy()V

    .line 134
    :cond_9
    invoke-super {p0}, Landroid/app/Activity;->onDestroy()V

    .line 135
    return-void
.end method

.method protected onPause()V
    .registers 2

    .line 123
    iget-object v0, p0, Lcom/app/antcolony/MainActivity;->webView:Landroid/webkit/WebView;

    if-eqz v0, :cond_9

    .line 124
    iget-object v0, p0, Lcom/app/antcolony/MainActivity;->webView:Landroid/webkit/WebView;

    invoke-virtual {v0}, Landroid/webkit/WebView;->onPause()V

    .line 126
    :cond_9
    invoke-super {p0}, Landroid/app/Activity;->onPause()V

    .line 127
    return-void
.end method

.method protected onResume()V
    .registers 2

    .line 115
    invoke-super {p0}, Landroid/app/Activity;->onResume()V

    invoke-direct {p0}, Lcom/app/antcolony/MainActivity;->applyChrome()V

    .line 116
    iget-object v0, p0, Lcom/app/antcolony/MainActivity;->webView:Landroid/webkit/WebView;

    if-eqz v0, :cond_c

    .line 117
    iget-object v0, p0, Lcom/app/antcolony/MainActivity;->webView:Landroid/webkit/WebView;

    invoke-virtual {v0}, Landroid/webkit/WebView;->onResume()V

    .line 119
    :cond_c
    return-void
.end method
