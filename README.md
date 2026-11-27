# Sổ đầu tư và Thu chi

Mở `index.html` hoặc lối tắt Desktop **So dau tu**.

Các file giao diện: `app.css`, `extras.css`, `manage.css`, `hud.css`. Logic: `app.js`, `extras.js`, `manage.js` (tab Quản lý) và `hud.js` (HUD Đầu tư, Thu chi). Dữ liệu lưu trong localStorage của trình duyệt. Dùng Xuất JSON thường xuyên để sao lưu; Xuất CSV tạo một file Excel-compatible gồm giao dịch và danh mục đầu tư.

Để cài PWA và bật service worker, phục vụ thư mục này qua HTTPS hoặc localhost. Mở file trực tiếp (`file://`) vẫn dùng được như ứng dụng ngoại tuyến, nhưng trình duyệt không cho service worker hoạt động ở giao thức này.