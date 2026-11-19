# Bật đăng nhập Google và phòng chơi cho Play with Zile

Trang web ở https://withonlyzile.github.io/boardgames/ đã chạy được phần luật chơi và các trò chơi trên một máy. Đăng nhập Google, phòng chơi với bạn bè và sửa game trên web cần thêm Firebase, dịch vụ miễn phí của Google. Làm một lần, mất khoảng 10 phút.

## 1. Tạo dự án Firebase

1. Mở https://console.firebase.google.com và đăng nhập bằng tài khoản Google của bạn.
2. Bấm **Create a project**, đặt tên `tu-luat-choi`. Tắt Google Analytics vì trang không cần.

## 2. Bật đăng nhập Google

1. Ở menu trái chọn **Build** rồi **Authentication**, bấm **Get started**.
2. Ở thẻ **Sign-in method**, chọn **Google**, bật **Enable**, chọn email hỗ trợ rồi bấm **Save**.
3. Ở thẻ **Settings**, mục **Authorized domains**, bấm **Add domain** và nhập `withonlyzile.github.io`.

## 3. Tạo kho dữ liệu

1. Chọn **Build** rồi **Firestore Database**, bấm **Create database**.
2. Chọn vị trí `asia-southeast1` cho gần Việt Nam, chọn **Start in production mode**.
3. Mở thẻ **Rules**, xóa nội dung cũ, dán toàn bộ nội dung file `firestore.rules` trong thư mục này rồi bấm **Publish**.

## 4. Lấy cấu hình gửi cho Claude

1. Bấm bánh răng cạnh **Project Overview**, chọn **Project settings**.
2. Ở mục **Your apps**, bấm biểu tượng `</>` để thêm ứng dụng web, đặt tên `tu-luat-choi`, không cần bật Hosting.
3. Firebase hiện một đoạn `const firebaseConfig = { ... }`. Chép đoạn này gửi cho Claude.

Đoạn cấu hình này là thông tin công khai của trang, không phải mật khẩu. Quyền đọc ghi do file `firestore.rules` quyết định.

## 5. Nhận quyền quản trị để sửa game

Làm bước này sau khi Claude đã gắn cấu hình và bạn đăng nhập trang một lần.

1. Trong Firebase, mở **Authentication** thẻ **Users**, chép mã ở cột **User UID** của tài khoản bạn.
2. Mở **Firestore Database**, bấm **Start collection**, đặt tên `admins`.
3. Ở **Document ID** dán mã UID vừa chép. Thêm một trường tên `role`, kiểu string, giá trị `owner`, rồi bấm **Save**.
4. Tải lại trang web. Nút **Thêm game** sẽ hiện ra, kèm nút nạp 37 game vào kho. Bấm nút nạp một lần là xong.

Bạn bè chỉ cần đăng nhập Google là mở phòng và vào phòng được, không cần quyền quản trị.
