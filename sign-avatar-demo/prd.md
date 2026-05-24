# PRODUCT REQUIREMENTS DOCUMENT (PRD)
## DỰ ÁN: HỆ THỐNG TRỢ LÝ ẢO VÀ HỌC TẬP NGÔN NGỮ KÝ HIỆU THỜI GIAN THỰC (Web-based MVP)

---

## 1. TỔNG QUAN DỰ ÁN (Dự án cá nhân định hướng Startup)
* **Tên dự án (Tạm thời):** SignLanguage 3D Lab (Ứng dụng Web)
* **Tầm nhìn (Vision):** Xóa bỏ rào cản giao tiếp và giáo dục cho cộng đồng người khiếm thính tại Việt Nam bằng công nghệ AI và Đồ họa 3D thời gian thực.
* **Mục tiêu MVP:** Xây dựng một nền tảng Web chạy được trên cả Máy tính & Điện thoại để validate (kiểm chứng) hai bài toán:
    1. Dịch thuật từ giọng nói giảng viên sang cử điệu Avatar 3D (Keyword-based).
    2. Hỗ trợ người dùng tự học bằng cách bật camera và chấm điểm động tác bằng AI (MediaPipe).

---

## 2. PHÂN TÍCH ĐỐI TƯỢNG NGƯỜI DÙNG (User Personas)
1.  **Người dùng cuối 1 (Người khiếm thính/Sinh viên khiếm thính):** Cần một công cụ hiển thị trực quan (Avatar 3D) cạnh slide bài giảng để hiểu nội dung thầy cô nói theo thời gian thực.
2.  **Người dùng cuối 2 (Người muốn học Ngôn ngữ ký hiệu):** Cần một môi trường tương tác trực quan, có người mẫu 3D hướng dẫn và có AI sửa sai xem mình làm đúng hay chưa.
3.  **Hệ quản trị (Admin/Creator - Chính bạn):** Cần một bộ công cụ (Lab tool) mạnh mẽ để số hóa, nặn pose và lưu trữ dữ liệu động tác vào database một cách nhanh nhất.

---

## 3. LỘ TRÌNH PHÁT TRIỂN (Roadmap từ A đến Z)
[GIỚI HẠN HIỆN TẠI] -> [GIAI ĐOẠN 1: CORE ENGINE & DATA] -> [GIAI ĐOẠN 2: MVP WEB APP] -> [TƯƠNG LAI: STARTUP SCALE-UP]


---

## GIAI ĐOẠN 1: CORE ENGINE & ĐÓNG GÓI BỘ DỮ LIỆU SỐ (Phát triển nội bộ)
*Mục tiêu: Hoàn thiện công cụ nặn Pose, tạo cơ sở dữ liệu cho 29 chữ cái Tiếng Việt (Finger Spelling) và một số từ vựng cơ bản.*

### 1.1 Tính năng Xuất/Nhập dữ liệu Xương (Pose Serialization)
* **Mô tả:** Cho phép lưu trạng thái xoay (Rotation) của toàn bộ các khớp xương tay (`mixamorig...`) từ giao diện Lab hiện tại thành file cấu trúc JSON và ngược lại.
* **Yêu cầu kỹ thuật:**
    * Nút **[Export Pose JSON]**: Duyệt qua danh sách xương ngón tay đang active, lấy giá trị Quaternion/Euler (`x, y, z`), đóng gói thành Object JSON kèm tên Pose (Ví dụ: `"chu_A"`).
    * Nút **[Import Pose JSON]**: Cho phép chọn/load file JSON cấu hình để Avatar lập tức chuyển sang tư thế đó.
    * Cơ chế lưu trữ tạm thời: Cho phép lưu nhanh vào `localStorage` hoặc tải trực tiếp file về máy.

### 1.2 Xây dựng Thư viện Animation mượt mà (Interpolation Engine)
* **Mô tả:** Khi chuyển từ tư thế này sang tư thế khác, tay nhân vật không được khựng hoặc dịch chuyển tức thời (teleport) mà phải co duỗi tự nhiên.
* **Yêu cầu kỹ thuật:**
    * Tích hợp thư viện **Tween.js** hoặc **GSAP** vào Three.js.
    * Viết hàm `transitionToPose(targetPose, duration)` để tính toán nội suy các góc xoay từ Pose hiện tại sang Pose đích trong khoảng thời gian mong muốn (Ví dụ: `300ms`).

### 1.3 Số hóa bộ dữ liệu Bảng chữ cái ngón tay (Data Entry)
* **Mô tả:** Sử dụng chính công cụ Lab để tạo và lưu trữ file cấu hình cho:
    * 29 Chữ cái Tiếng Việt (A, Ă, Â, B, C, D, Đ, E, Ê...).
    * 10 Chữ số cơ bản (0 - 9).
    * 5 Từ giao tiếp thiết yếu (Xin chào, Cảm ơn, Xin lỗi, Đúng, Sai).

---

## GIAI ĐOẠN 2: TÍCH HỢP AI & HOÀN THIỆN MVP WEB APP (Ra mắt người dùng)
*Mục tiêu: Đóng gói giao diện người dùng (End-user UI), tích hợp nhận diện giọng nói và nhận diện camera để kiểm tra.*

### 2.1 Tính năng: Trợ lý dịch thuật trực tiếp (Speech-to-Sign)
* **Giao diện:** * Khu vực hiển thị Avatar 3D lớn, chiếm không gian chính.
    * Nút bấm **[Bật Trợ Lý Nghe]** trực quan.
    * Dòng chữ phụ đề (Subtitles) chạy bên dưới chân Avatar.
* **Luồng xử lý dữ liệu (Luồng xuôi):**
    1.  Người dùng bấm nút $\rightarrow$ Kích hoạt **Web Speech API** trên trình duyệt (Yêu cầu quyền Micro).
    2.  Trình duyệt trả về chuỗi văn bản Tiếng Việt theo thời gian thực (Real-time Text).
    3.  Hệ thống chạy thuật toán tách chuỗi (Tokenization) cắt văn bản thành mảng các từ hoặc chữ cái đơn lẻ.
    4.  Hệ thống đối chiếu với bộ Từ điển JSON (Giai đoạn 1).
    5.  **Trigger Animation:** Đẩy các tư thế tương ứng vào hàng đợi (Queue) để Avatar 3D "múa" liên tục theo thứ tự từ khóa bắt được.

### 2.2 Tính năng: Phòng học tương tác & Chấm điểm AI (Camera-to-Score)
* **Giao diện:** Chia đôi màn hình (Split View).
    * Bên trái: Avatar 3D thực hiện động tác mẫu theo vòng lặp (Loop).
    * Bên phải: Ô hiển thị Camera thời gian thực từ Webcam/Điện thoại của người dùng.
    * Thanh hiển thị kết quả: Hiển thị thanh tiến trình độ chính xác (%).
* **Luồng xử lý dữ liệu (Luồng ngược):**
    1.  Người dùng chọn bài học (Ví dụ: Học chữ "C"). Avatar bên trái sẽ làm mẫu liên tục chữ "C".
    2.  Hệ thống kích hoạt webcam qua câu lệnh `getUserMedia` (Yêu cầu quyền Camera).
    3.  Tải thư viện **Google MediaPipe Hands** (phiên bản JavaScript qua CDN).
    4.  MediaPipe phân tích từng frame hình ảnh từ camera và trả về tọa độ 21 điểm khớp ngón tay (Landmarks) dạng $(x, y, z)$.
    5.  **Hàm chấm điểm (Evaluation Logic):** * Tính toán khoảng cách tương đối giữa các đầu ngón tay từ camera (để không bị ảnh hưởng bởi việc người dùng đứng xa hay gần camera).
        * So sánh với tỷ lệ khoảng cách chuẩn của Model 3D ở Giai đoạn 1.
        * Nếu độ trùng khớp $> 85\% \rightarrow$ Hiện hiệu ứng chúc mừng (Confetti), cộng điểm và tự động chuyển sang bài tiếp theo.

### 2.3 Yêu cầu Hạ tầng & Triển khai (Deployment)
* **Bảo mật:** Bắt buộc cấu hình chứng chỉ SSL (`https://`) để các trình duyệt bảo mật (Chrome, Safari) cho phép chạy Camera và Micro.
* **Hosting:** Deploy Frontend lên **Vercel** hoặc **Netlify** để tận dụng CDN phân phối file 3D `.gltf/.glb` nhanh, mượt.
* **Cơ sở dữ liệu giai đoạn MVP:** Lưu trữ file cấu hình dạng JSON tĩnh (Static JSON assets) trực tiếp trong source code Frontend để tối ưu tốc độ load, không cần kết nối API Server Database phức tạp ở bước này.

---

## GIAI ĐOẠN 3: ĐÁNH GIÁ SẢN PHẨM & ĐỊNH HƯỚNG STARTUP (Tương lai)
*Mục tiêu: Đưa sản phẩm đến cộng đồng, thu thập số liệu phục vụ gọi vốn và chuyển đổi sang Mobile App.*

### 3.1 Tiêu chí đo lường thành công của MVP (Success Metrics)
* **Độ chính xác STT:** Tỷ lệ nhận diện giọng nói tiếng Việt đạt trên 85% trong môi trường lớp học thông thường.
* **Hiệu năng Web:** Tốc độ render khung hình (FPS) của Avatar 3D đạt tối thiểu 45-60 FPS trên các thiết bị smartphone tầm trung thông qua trình duyệt web di động.
* **Độ mượt AI:** MediaPipe bắt tọa độ xương tay trên điện thoại không gây tình trạng quá nhiệt hoặc lag máy.
* **Traction bước đầu:** Nhận được ít nhất 50 phản hồi tích cực từ cộng đồng người học hoặc người yếu thế để làm minh chứng ý tưởng (Proof of Concept).

### 3.2 Kế hoạch chuyển đổi lên Mobile App (Next Stage)
* Khi Web MVP chạy thành công và chứng minh được mô hình gọi vốn:
    * Sử dụng **Capacitor** hoặc **PWA (Progressive Web App)** để đóng gói nhanh bản Web hiện tại thành App cài đặt trên điện thoại.
    * Hoặc chuyển giao công nghệ sang **Flutter / Unity** để xây dựng app mobile native thuầ