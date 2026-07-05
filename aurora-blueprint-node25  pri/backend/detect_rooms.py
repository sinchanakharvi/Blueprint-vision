import cv2, sys, json, pytesseract, numpy as np, os

# If tesseract is not auto-detected, set path:
# pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

img_path = sys.argv[1]
img = cv2.imread(img_path)

if img is None:
    print(json.dumps([]))
    exit()

# Resize large images
h, w = img.shape[:2]
max_dim = 1600
if max(h, w) > max_dim:
    scale = max_dim / max(h, w)
    img = cv2.resize(img, (int(w*scale), int(h*scale)), interpolation=cv2.INTER_AREA)

gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
gray = cv2.equalizeHist(gray)
blur = cv2.GaussianBlur(gray, (5,5), 0)

# Threshold
_, th1 = cv2.threshold(blur, 180, 255, cv2.THRESH_BINARY_INV)
th2 = cv2.adaptiveThreshold(blur, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                            cv2.THRESH_BINARY_INV, 21, 9)

binary = cv2.bitwise_or(th1, th2)

kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (7,7))
closed = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel, iterations=2)

# Contours
contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

min_area = (img.shape[0] * img.shape[1]) * 0.002
rooms = []

for cnt in contours:
    area = cv2.contourArea(cnt)
    if area < min_area: continue
    
    x,y,w_box,h_box = cv2.boundingRect(cnt)
    if w_box < 60 or h_box < 60: continue

    rooms.append({
        "name": "Room",
        "x": int(x),
        "y": int(y),
        "width": int(w_box),
        "height": int(h_box),
    })

# Convert to normalized coords
h2, w2 = img.shape[:2]
normalized = [{
    "name": f"Room {i+1}",
    "x_pct": r["x"] / w2,
    "y_pct": r["y"] / h2,
    "w_pct": r["width"] / w2,
    "h_pct": r["height"] / h2
} for i, r in enumerate(rooms)]

print(json.dumps(normalized))
