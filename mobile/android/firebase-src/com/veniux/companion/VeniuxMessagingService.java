package com.veniux.companion;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.os.Build;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

public class VeniuxMessagingService extends FirebaseMessagingService {
  @Override public void onNewToken(String token) { FirebaseGlue.saveToken(this, token); }

  // Uygulama açıkken gelen bildirim: FCM bunu kendisi göstermez, burada gösterilir. Kapalıyken FCM kendisi gösterir.
  @Override public void onMessageReceived(RemoteMessage message) {
    RemoteMessage.Notification notification = message.getNotification();
    if (notification == null) return;
    try {
      FirebaseGlue.ensureChannel(this);
      NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
      if (manager == null) return;
      Intent open = new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
      String url = message.getData().get("url");
      if (url != null) open.putExtra("url", url);
      PendingIntent pending = PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
      Notification.Builder builder = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, "veniux-alerts") : new Notification.Builder(this);
      String text = notification.getBody() == null ? "" : notification.getBody();
      builder.setSmallIcon(R.drawable.logo).setContentTitle(notification.getTitle()).setContentText(text)
        .setStyle(new Notification.BigTextStyle().bigText(text)).setContentIntent(pending).setAutoCancel(true);
      String tag = message.getData().get("tag");
      manager.notify(tag == null ? "veniux" : tag, 2000, builder.build());
    } catch (Exception ignored) { }
  }
}
