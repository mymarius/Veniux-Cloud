import com.google.zxing.*;
import com.google.zxing.common.*;
import java.awt.image.BufferedImage;
import javax.imageio.ImageIO;
import java.io.File;
import java.util.*;
public class OpticalLab {
 public static void main(String[] args)throws Exception{
  if(!"test".equals(System.getenv("NODE_ENV"))||!"1".equals(System.getenv("VENIUX_HARDWARE_LAB")))throw new IllegalStateException("Test-only optical laboratory");
  String[][] samples={{"EAN_13","5901234123457"},{"UPC_A","012345678905"},{"CODE_128","CODE128-0007"},{"DATA_MATRIX","0001ABC"},{"QR_CODE","VNX-LAB-ONLY"}};
  for(String[] sample:samples){
   BarcodeFormat format=BarcodeFormat.valueOf(sample[0]);int width=480,height=240;
   BitMatrix bits=new MultiFormatWriter().encode(sample[1],format,width,height);
   int paddedWidth=width+64,paddedHeight=height+64;
   BufferedImage image=new BufferedImage(paddedWidth,paddedHeight,BufferedImage.TYPE_INT_RGB);
   int[] pixels=new int[paddedWidth*paddedHeight];for(int y=0;y<paddedHeight;y++)for(int x=0;x<paddedWidth;x++){boolean inside=x>=32&&y>=32&&x<width+32&&y<height+32;int color=inside&&bits.get(x-32,y-32)?0x000000:0xffffff;image.setRGB(x,y,color);pixels[y*paddedWidth+x]=color;}
   ImageIO.write(image,"png",new File(args[0],"optical-"+sample[0]+".png"));
   Map<DecodeHintType,Object> hints=new EnumMap<>(DecodeHintType.class);hints.put(DecodeHintType.POSSIBLE_FORMATS,Collections.singletonList(format));
   Result result=new MultiFormatReader().decode(new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(paddedWidth,paddedHeight,pixels))),hints);
   if(!sample[1].equals(result.getText()))throw new AssertionError("Optical payload mismatch "+format);
   System.out.println("PASS LAB-OPTICAL "+format+" generated image decoded without losing leading zeros");
  }
 }
}
