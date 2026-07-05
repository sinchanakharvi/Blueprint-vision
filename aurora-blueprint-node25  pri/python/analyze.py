import sys
import json
from pathlib import Path
import cv2
import numpy as np
from PIL import Image

# ---------- parameters for room shapes ----------
MIN_ROOM_AREA = 6000       # ignore tiny blobs
MAX_ROOM_RATIO = 0.85      # ignore contour that is almost whole image
MIN_ROOM_WIDTH = 60        # ignore very thin pieces
MIN_ROOM_HEIGHT = 60
# ------------------------------------------------


def load_image_any(path):
    """
    Load image in PNG/JPG/GIF formats.
    OpenCV cannot load GIF, so we use PIL as fallback.
    """
    # Try OpenCV first
    img = cv2.imread(path)

    if img is not None:
        return img

    # Fallback for GIF / unsupported formats
    try:
        pil = Image.open(path).convert("RGB")
        return cv2.cvtColor(np.array(pil), cv2.COLOR_RGB2BGR)
    except:
        return None


def detect_rooms_by_shape(img):
    """
    Use image processing to find closed regions that look like rooms.
    Returns list of dicts with bbox + center + area.
    """
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (5, 5), 0)

    # Lines/walls are dark -> make them white on black background
    _, th = cv2.threshold(
        blur, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU
    )

    # Close small gaps in walls so rooms become solid blobs
    kernel = np.ones((5, 5), np.uint8)
    closed = cv2.morphologyEx(th, cv2.MORPH_CLOSE, kernel, iterations=2)

    # Remove small noise
    kernel2 = np.ones((3, 3), np.uint8)
    opened = cv2.morphologyEx(closed, cv2.MORPH_OPEN, kernel2, iterations=1)

    # External contours = candidate rooms
    contours, _ = cv2.findContours(
        opened, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
    )

    h_img, w_img = img.shape[:2]
    img_area = w_img * h_img

    rooms = []

    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < MIN_ROOM_AREA:
            continue
        if area > MAX_ROOM_RATIO * img_area:
            continue

        x, y, w, h = cv2.boundingRect(cnt)
        if w < MIN_ROOM_WIDTH or h < MIN_ROOM_HEIGHT:
            continue

        cx = x + w / 2.0
        cy = y + h / 2.0

        rooms.append(
            {
                "bbox": {
                    "x": int(x),
                    "y": int(y),
                    "width": int(w),
                    "height": int(h),
                },
                "center": {"x": float(cx), "y": float(cy)},
                "area": float(area),
            }
        )

    # Sort largest rooms first (for nicer naming)
    rooms.sort(key=lambda r: -r["area"])
    return rooms


def assign_names_by_layout(rooms, img_width, img_height):
    """
    Give each detected room a semantic name based on its position.
    """
    n = len(rooms)
    names = [f"Area {i+1}" for i in range(n)]
    if n == 0:
        return names

    mid_x = img_width / 2.0
    mid_y = img_height / 2.0

    indexed = list(enumerate(rooms))

    # Split into left / right side
    left = [(i, r) for i, r in indexed if r["center"]["x"] < mid_x]
    right = [(i, r) for i, r in indexed if r["center"]["x"] >= mid_x]

    # LEFT SIDE
    if left:
        top_left = min(left, key=lambda ir: ir[1]["center"]["y"])
        names[top_left[0]] = "Master Bedroom"

        if len(left) > 1:
            bottom_left = max(left, key=lambda ir: ir[1]["center"]["y"])
            if bottom_left[0] != top_left[0]:
                names[bottom_left[0]] = "Living Room"

    # RIGHT SIDE
    if right:
        top_right = min(right, key=lambda ir: ir[1]["center"]["y"])
        names[top_right[0]] = "Bedroom 2"

        right_lower = [
            (i, r) for i, r in right if r["center"]["y"] >= mid_y
        ]
        if right_lower:
            largest = max(right_lower, key=lambda ir: ir[1]["area"])
            smallest = min(right_lower, key=lambda ir: ir[1]["area"])

            names[largest[0]] = "Kitchen"
            if smallest[0] != largest[0]:
                names[smallest[0]] = "Bathroom"

    return names


def analyze_blueprint(image_path: str):
    image_path = Path(image_path)

    img = load_image_any(str(image_path))
    if img is None:
        return {"width": 0, "height": 0, "areas": []}

    h_img, w_img = img.shape[:2]

    rooms = detect_rooms_by_shape(img)
    names = assign_names_by_layout(rooms, w_img, h_img)

    areas = []
    for idx, room in enumerate(rooms):
        areas.append(
            {
                "id": idx + 1,
                "name": names[idx],
                "bbox": room["bbox"],
                "iconPosition": room["center"],
            }
        )

    # fallback if nothing is detected
    if not areas:
        areas = [
            {
                "id": 1,
                "name": "Living Room",
                "bbox": {
                    "x": 0,
                    "y": 0,
                    "width": int(w_img),
                    "height": int(h_img),
                },
                "iconPosition": {
                    "x": float(w_img / 2),
                    "y": float(h_img / 2),
                },
            }
        ]

    return {"width": int(w_img), "height": int(h_img), "areas": areas}


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"width": 0, "height": 0, "areas": []}))
        sys.exit(0)

    image_path = sys.argv[1]

    try:
        result = analyze_blueprint(image_path)
    except Exception as e:
        result = {
            "width": 0,
            "height": 0,
            "areas": [],
            "error": str(e),
        }

    print(json.dumps(result))
    sys.exit(0)


if __name__ == "__main__":
    main()
