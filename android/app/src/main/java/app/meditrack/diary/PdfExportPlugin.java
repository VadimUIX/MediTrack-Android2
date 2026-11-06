package app.meditrack.diary;

import android.content.ClipData;
import android.content.Intent;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Typeface;
import android.graphics.pdf.PdfDocument;
import android.net.Uri;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@CapacitorPlugin(name = "PdfExport")
public class PdfExportPlugin extends Plugin {
    private static final int PAGE_WIDTH = 595;
    private static final int PAGE_HEIGHT = 842;
    private static final float LEFT = 46f;
    private static final float RIGHT = 549f;
    private static final float BOTTOM = 790f;

    @PluginMethod
    public void createAndShare(PluginCall call) {
        String requestedName = call.getString("fileName", "MediTrack-report.pdf");
        JSArray lines = call.getArray("lines");
        if (lines == null) {
            call.reject("В отчёте нет данных для PDF.");
            return;
        }

        String safeName = requestedName == null ? "MediTrack-report.pdf" : requestedName.replaceAll("[^a-zA-Z0-9._-]", "_");
        if (!safeName.toLowerCase(Locale.ROOT).endsWith(".pdf")) safeName += ".pdf";

        File exportDir = new File(getContext().getCacheDir(), "exports");
        if (!exportDir.exists() && !exportDir.mkdirs()) {
            call.reject("Не удалось подготовить файл отчёта.");
            return;
        }

        File pdfFile = new File(exportDir, safeName);
        PdfDocument document = new PdfDocument();
        try {
            PageCursor cursor = new PageCursor(document);
            cursor.startPage();

            Paint body = paint(11f, Color.rgb(42, 52, 45), Typeface.NORMAL);
            Paint muted = paint(9f, Color.rgb(105, 116, 106), Typeface.NORMAL);
            Paint heading = paint(15f, Color.rgb(42, 83, 63), Typeface.BOLD);
            Paint title = paint(25f, Color.rgb(37, 67, 51), Typeface.BOLD);
            Paint tableHeader = paint(10f, Color.WHITE, Typeface.BOLD);
            Paint tableRow = paint(9.5f, Color.rgb(42, 52, 45), Typeface.NORMAL);

            for (int i = 0; i < lines.length(); i++) {
                JSONObject item = lines.optJSONObject(i);
                if (item == null) continue;
                String text = item.optString("text", "");
                String style = item.optString("style", "body");
                if (text.trim().isEmpty()) {
                    cursor.y += 7f;
                    continue;
                }

                Paint selected = body;
                float gapBefore = 0f;
                float lineHeight = 16f;
                if ("title".equals(style)) {
                    selected = title;
                    gapBefore = 7f;
                    lineHeight = 34f;
                } else if ("heading".equals(style)) {
                    selected = heading;
                    gapBefore = 12f;
                    lineHeight = 22f;
                } else if ("muted".equals(style)) {
                    selected = muted;
                    lineHeight = 14f;
                } else if ("tableHeader".equals(style)) {
                    selected = tableHeader;
                    gapBefore = 4f;
                    lineHeight = 22f;
                } else if ("tableRow".equals(style)) {
                    selected = tableRow;
                    lineHeight = 19f;
                }

                cursor.y += gapBefore;
                List<String> wrapped = wrap(text, selected, RIGHT - LEFT - 18f);
                for (int lineIndex = 0; lineIndex < wrapped.size(); lineIndex++) {
                    if (cursor.y + lineHeight > BOTTOM) cursor.nextPage();
                    if ("tableHeader".equals(style)) {
                        Paint bg = new Paint(Paint.ANTI_ALIAS_FLAG);
                        bg.setColor(Color.rgb(55, 91, 70));
                        cursor.canvas.drawRoundRect(LEFT, cursor.y - 15f, RIGHT, cursor.y + 5f, 4f, 4f, bg);
                        cursor.canvas.drawText(wrapped.get(lineIndex), LEFT + 9f, cursor.y, selected);
                    } else if ("tableRow".equals(style)) {
                        if (lineIndex == 0) {
                            Paint rule = new Paint(Paint.ANTI_ALIAS_FLAG);
                            rule.setColor(Color.rgb(226, 232, 225));
                            rule.setStrokeWidth(0.7f);
                            cursor.canvas.drawLine(LEFT, cursor.y + 5f, RIGHT, cursor.y + 5f, rule);
                        }
                        cursor.canvas.drawText(wrapped.get(lineIndex), LEFT + 7f, cursor.y, selected);
                    } else {
                        cursor.canvas.drawText(wrapped.get(lineIndex), LEFT, cursor.y, selected);
                    }
                    cursor.y += lineHeight;
                }
            }

            cursor.finishPage();
            try (FileOutputStream output = new FileOutputStream(pdfFile)) {
                document.writeTo(output);
            }
            document.close();

            Uri contentUri = FileProvider.getUriForFile(
                getContext(),
                getContext().getPackageName() + ".fileprovider",
                pdfFile
            );
            Intent share = new Intent(Intent.ACTION_SEND);
            share.setType("application/pdf");
            share.putExtra(Intent.EXTRA_STREAM, contentUri);
            share.putExtra(Intent.EXTRA_TITLE, "Отчёт MediTrack");
            share.setClipData(ClipData.newUri(getContext().getContentResolver(), safeName, contentUri));
            share.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

            getActivity().runOnUiThread(() -> {
                try {
                    getActivity().startActivity(Intent.createChooser(share, "Сохранить или отправить PDF"));
                    JSObject result = new JSObject();
                    result.put("uri", contentUri.toString());
                    call.resolve(result);
                } catch (Exception error) {
                    call.reject("PDF создан, но не удалось открыть меню отправки.", error);
                }
            });
        } catch (Exception error) {
            document.close();
            call.reject("Не удалось сформировать PDF: " + error.getMessage(), error);
        }
    }

    private static Paint paint(float size, int color, int weight) {
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        paint.setTextSize(size);
        paint.setColor(color);
        paint.setTypeface(Typeface.create("sans-serif", weight));
        return paint;
    }

    private static List<String> wrap(String text, Paint paint, float maxWidth) {
        List<String> result = new ArrayList<>();
        StringBuilder line = new StringBuilder();
        for (String word : text.split("\\s+")) {
            String candidate = line.length() == 0 ? word : line + " " + word;
            if (paint.measureText(candidate) <= maxWidth) {
                line.setLength(0);
                line.append(candidate);
                continue;
            }
            if (line.length() > 0) {
                result.add(line.toString());
                line.setLength(0);
            }
            if (paint.measureText(word) <= maxWidth) {
                line.append(word);
            } else {
                int start = 0;
                while (start < word.length()) {
                    int count = paint.breakText(word, start, word.length(), true, maxWidth, null);
                    if (count <= 0) count = 1;
                    result.add(word.substring(start, start + count));
                    start += count;
                }
            }
        }
        if (line.length() > 0) result.add(line.toString());
        return result;
    }

    private static class PageCursor {
        final PdfDocument document;
        PdfDocument.Page page;
        Canvas canvas;
        float y = 58f;
        int pageNumber = 1;

        PageCursor(PdfDocument document) {
            this.document = document;
        }

        void startPage() {
            PdfDocument.PageInfo info = new PdfDocument.PageInfo.Builder(PAGE_WIDTH, PAGE_HEIGHT, pageNumber).create();
            page = document.startPage(info);
            canvas = page.getCanvas();
            canvas.drawColor(Color.WHITE);
            Paint rule = new Paint(Paint.ANTI_ALIAS_FLAG);
            rule.setColor(Color.rgb(220, 229, 219));
            rule.setStrokeWidth(1f);
            canvas.drawLine(LEFT, 38f, RIGHT, 38f, rule);
            y = 62f;
        }

        void nextPage() {
            finishPage();
            pageNumber++;
            startPage();
        }

        void finishPage() {
            if (page != null) {
                Paint footer = paint(8f, Color.rgb(130, 139, 130), Typeface.NORMAL);
                canvas.drawText("MediTrack", LEFT, PAGE_HEIGHT - 25f, footer);
                canvas.drawText(String.valueOf(pageNumber), RIGHT - 8f, PAGE_HEIGHT - 25f, footer);
                document.finishPage(page);
                page = null;
            }
        }
    }
}
