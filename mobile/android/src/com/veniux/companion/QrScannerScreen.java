package com.veniux.companion;

import android.content.Context;
import android.graphics.*;
import android.graphics.drawable.GradientDrawable;
import android.view.*;
import android.widget.*;

/** Camera chrome only. Camera frames and pairing credentials never enter this view. */
final class QrScannerScreen extends FrameLayout {
 interface Actions { void close(); void manual(); void help(); void torch(); }
 final SurfaceView preview;
 private final FrameLayout cameraLayer;
 private final TextView status,torch;
 private final Typeface font;
 private int previewWidth=480,previewHeight=640;
 private final int ink=Color.rgb(13,25,43);
 QrScannerScreen(Context context,Typeface typeface,Actions actions){
  super(context);font=typeface;setBackgroundColor(ink);
  cameraLayer=new FrameLayout(context);cameraLayer.setClipChildren(true);addView(cameraLayer,new LayoutParams(-1,-1));
  preview=new SurfaceView(context);cameraLayer.addView(preview,new LayoutParams(-1,-1,Gravity.CENTER));
  LinearLayout chrome=new LinearLayout(context);chrome.setOrientation(1);addView(chrome,new LayoutParams(-1,-1));
  LinearLayout header=new LinearLayout(context);header.setGravity(Gravity.CENTER_VERTICAL);header.setPadding(d(20),d(14),d(20),d(14));header.setBackgroundColor(Color.argb(235,13,25,43));
  TextView back=button("Geri",()->actions.close());header.addView(back,new LinearLayout.LayoutParams(d(58),d(48)));
  LinearLayout brand=new LinearLayout(context);brand.setOrientation(1);brand.setGravity(Gravity.CENTER);brand.addView(label("VENIUX",12,Color.rgb(142,182,228)));brand.addView(label("Cihaz eşleştirme",17,Color.WHITE));header.addView(brand,new LinearLayout.LayoutParams(0,-2,1));
  header.addView(button("Yardım",()->actions.help()),new LinearLayout.LayoutParams(d(66),d(48)));chrome.addView(header);
  boolean wide=getResources().getConfiguration().orientation==android.content.res.Configuration.ORIENTATION_LANDSCAPE;LinearLayout body=new LinearLayout(context);body.setOrientation(wide?0:1);chrome.addView(body,new LinearLayout.LayoutParams(-1,0,1));FrameLayout guide=new FrameLayout(context);guide.addView(new Finder(context),new LayoutParams(-1,-1));body.addView(guide,wide?new LinearLayout.LayoutParams(0,-1,1):new LinearLayout.LayoutParams(-1,0,1));
  LinearLayout bottom=new LinearLayout(context);bottom.setOrientation(1);bottom.setPadding(d(24),d(20),d(24),d(20));bottom.setBackgroundColor(Color.argb(245,13,25,43));
  TextView title=label("QR kodunu hizalayın",24,Color.WHITE);bottom.addView(title);
  status=label("Bilgisayarınızdaki Veniux eşleştirme kodunu çerçeveye getirin. Okuma otomatik başlar.",14,Color.rgb(186,202,223));status.setPadding(0,d(10),0,d(16));status.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE);bottom.addView(status);
  LinearLayout controls=new LinearLayout(context);controls.setGravity(Gravity.CENTER_VERTICAL);torch=button("Fener",()->actions.torch());torch.setEnabled(false);torch.setAlpha(.45f);controls.addView(torch,new LinearLayout.LayoutParams(0,d(52),1));
  View spacer=new View(context);controls.addView(spacer,new LinearLayout.LayoutParams(d(12),1));TextView manual=button("Kodu elle gir",()->actions.manual());manual.setBackground(shape(Color.rgb(32,100,185),16));controls.addView(manual,new LinearLayout.LayoutParams(0,d(52),2));bottom.addView(controls);
  TextView privacy=label("Kamera görüntüsü bu cihazda kalır.",11,Color.rgb(153,174,199));privacy.setPadding(0,d(16),0,0);privacy.setGravity(Gravity.CENTER);bottom.addView(privacy);ScrollView details=new ScrollView(context);details.setFillViewport(true);details.setBackgroundColor(Color.argb(245,13,25,43));details.addView(bottom);body.addView(details,wide?new LinearLayout.LayoutParams(d(320),-1):new LinearLayout.LayoutParams(-1,-2));
  setOnApplyWindowInsetsListener((v,insets)->{setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());return insets;});
 }
 void previewShape(int width,int height){previewWidth=width;previewHeight=height;fitPreview();}
 private void fitPreview(){int w=getWidth(),h=getHeight();if(w==0||h==0)return;float scale=Math.max((float)w/previewWidth,(float)h/previewHeight);preview.setLayoutParams(new FrameLayout.LayoutParams(Math.round(previewWidth*scale),Math.round(previewHeight*scale),Gravity.CENTER));}
 @Override protected void onSizeChanged(int w,int h,int oldW,int oldH){super.onSizeChanged(w,h,oldW,oldH);fitPreview();}
 void torchState(boolean supported,boolean on){torch.setEnabled(supported);torch.setAlpha(supported?1:.45f);torch.setText(on?"Fener açık":"Fener");torch.setContentDescription(supported?(on?"Feneri kapat":"Feneri aç"):"Bu kamerada fener kullanılamıyor");}
 void message(String value){status.setText(value);}
 private TextView label(String value,int size,int color){TextView t=new TextView(getContext());t.setText(value);t.setTextSize(size);t.setTypeface(font);t.setTextColor(color);t.setLineSpacing(d(3),1);return t;}
 private TextView button(String value,Runnable action){TextView t=label(value,14,Color.WHITE);t.setGravity(Gravity.CENTER);t.setBackground(shape(Color.rgb(34,49,70),16));t.setFocusable(true);t.setClickable(true);t.setOnClickListener(v->action.run());t.setForeground(new android.graphics.drawable.RippleDrawable(android.content.res.ColorStateList.valueOf(0x407bb5ff),null,shape(Color.WHITE,16)));return t;}
 private GradientDrawable shape(int color,int radius){GradientDrawable s=new GradientDrawable();s.setColor(color);s.setCornerRadius(d(radius));return s;}
 private int d(int n){return Math.round(n*getResources().getDisplayMetrics().density);}
 private final class Finder extends View {
  private final Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);
  Finder(Context c){super(c);setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);}
  @Override protected void onDraw(Canvas canvas){super.onDraw(canvas);float side=Math.min(Math.min(getWidth()-d(64),getHeight()-d(32)),d(280));if(side<d(60))return;float left=(getWidth()-side)/2,top=(getHeight()-side)/2,right=left+side,bottom=top+side;
   Path shade=new Path();shade.setFillType(Path.FillType.EVEN_ODD);shade.addRect(0,0,getWidth(),getHeight(),Path.Direction.CW);shade.addRoundRect(new RectF(left,top,right,bottom),d(22),d(22),Path.Direction.CW);paint.setStyle(Paint.Style.FILL);paint.setColor(0x80081121);canvas.drawPath(shade,paint);
   paint.setStyle(Paint.Style.STROKE);paint.setStrokeWidth(d(1));paint.setColor(0x55ffffff);canvas.drawRoundRect(new RectF(left,top,right,bottom),d(22),d(22),paint);
   paint.setStrokeWidth(d(4));paint.setStrokeCap(Paint.Cap.ROUND);paint.setStrokeJoin(Paint.Join.ROUND);paint.setColor(Color.rgb(91,170,255));float len=d(30),r=d(20);Path corners=new Path();corners.moveTo(left,top+len);corners.lineTo(left,top+r);corners.quadTo(left,top,left+r,top);corners.lineTo(left+len,top);corners.moveTo(right-len,top);corners.lineTo(right-r,top);corners.quadTo(right,top,right,top+r);corners.lineTo(right,top+len);corners.moveTo(right,bottom-len);corners.lineTo(right,bottom-r);corners.quadTo(right,bottom,right-r,bottom);corners.lineTo(right-len,bottom);corners.moveTo(left+len,bottom);corners.lineTo(left+r,bottom);corners.quadTo(left,bottom,left,bottom-r);corners.lineTo(left,bottom-len);canvas.drawPath(corners,paint);
   paint.setColor(Color.rgb(255,153,76));canvas.drawLine(left+side*.43f,top,left+side*.57f,top,paint);paint.setStyle(Paint.Style.FILL);
  }
 }
}
