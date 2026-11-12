package com.veniux.companion;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.messaging.FirebaseMessaging;

// Firebase Cloud Messaging köprüsü. Yalnız Firebase paketi ve yapılandırma varsa derlenir; MainActivity buna yansıma (reflection) ile ulaşır.
public final class FirebaseGlue {
  private FirebaseGlue() {}

  static SharedPreferences prefs(Context context) { return context.getSharedPreferences("veniux_fcm", Context.MODE_PRIVATE); }

  public static String token(Context context) { return prefs(context).getString("token", ""); }

  public static void saveToken(Context context, String token) { prefs(context).edit().putString("token", token == null ? "" : token).apply(); }

  static void ensureChannel(Context context) {
    if (Build.VERSION.SDK_INT < 26) return;
    NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
    if (manager != null && manager.getNotificationChannel("veniux-alerts") == null)
      manager.createNotificationChannel(new NotificationChannel("veniux-alerts", "Stok uyarıları", NotificationManager.IMPORTANCE_HIGH));
  }

  // Uygulama açılırken: Firebase'i yapılandırmadan başlat, kanalı oluştur, token'ı al ve sakla.
  public static void start(Context context) {
    Context app = context.getApplicationContext();
    if (FirebaseApp.getApps(app).isEmpty()) {
      FirebaseOptions options = new FirebaseOptions.Builder()
        .setApplicationId(FirebaseConfig.APP_ID).setApiKey(FirebaseConfig.API_KEY)
        .setProjectId(FirebaseConfig.PROJECT_ID).setGcmSenderId(FirebaseConfig.SENDER_ID).build();
      FirebaseApp.initializeApp(app, options);
    }
    ensureChannel(app);
    FirebaseMessaging.getInstance().getToken().addOnCompleteListener(task -> {
      if (task.isSuccessful() && task.getResult() != null) saveToken(app, task.getResult());
    });
  }
}
