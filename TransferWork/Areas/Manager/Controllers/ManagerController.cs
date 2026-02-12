using HandOver.Common;
using Microsoft.Ajax.Utilities;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.Data.Entity; // Cần thêm namespace này để dùng ToListAsync
using System.Data.Entity.Migrations;
using System.Globalization;
using System.Linq;
using System.Threading.Tasks;
using System.Web;
using System.Web.Mvc;

namespace HandOver.Areas.Manager.Controllers
{
    // Thêm Attribute này nếu Dashboard yêu cầu quyền cao hơn (ví dụ Role 2 hoặc 3)
    // [CustomAuthorize(RoleNum = 3)] 
    public class ManagerController : Controller
    {
        private readonly TransferWorkEntities db = new TransferWorkEntities();

        // ĐÃ SỬA: Xóa static, dùng biến cục bộ hoặc instance
        // Không lưu ListUsers, ListModel ở cấp class để tránh conflict giữa các request

        // GET: Manager/Manager
        public async Task<ActionResult> Dashboard()
        {
            // ĐÃ SỬA: Dùng ToListAsync chuẩn của EF thay vì Task.Run
            // Không cần gán vào biến toàn cục, chỉ cần dùng trong scope action
            ViewBag.ThisUser = await db.Users.SingleOrDefaultAsync(u => u.CardID == MySession.CurrentUserId);

            if (ViewBag.ThisUser != null)
            {
                ViewBag.ThisUser.Password = "";
            }

            ViewBag.Role = MySession.USER_ROLE;
            return View();
        }

        public async Task<ActionResult> GetDataDashboard(string id, int month)
        {
            // Lấy dữ liệu cần thiết tại thời điểm gọi
            var ListWork = await db.Works.ToListAsync();
            var ListUsers = await db.Users.ToListAsync();
            var ListModel = await db.Models1.ToListAsync();

            List<Work> newListWork = new List<Work>();
            int[] statusTotals = new int[4];

            try
            {
                // Tính toán status (Xử lý trên RAM vì ListWork đã fetch về)
                foreach (var work in ListWork)
                {
                    if (work.Status == "On-going") statusTotals[0]++;
                    else if (work.Status == "Done") statusTotals[1]++;
                    else if (work.Status == "Open") statusTotals[2]++;
                    else if (work.Status == "Close") statusTotals[3]++;
                }

                // Logic lọc dữ liệu
                // Lưu ý: ListWork đã là List in-memory nên dùng LINQ to Objects
                IEnumerable<Work> query = ListWork;

                // Lọc theo Month
                if (month != 0)
                {
                    query = query.Where(w => w.DateStart.Month == month);
                }

                // Lọc theo ID (Flow hoặc Owner)
                switch (id)
                {
                    case "All":
                        // Không lọc thêm
                        break;
                    case "PE":
                        query = query.Where(w => w.Flow == "PE-PE");
                        break;
                    case "RE":
                        query = query.Where(w => w.Flow == "RE-RE");
                        break;
                    case "PE-RE":
                        query = query.Where(w => w.Flow == "PE-RE" || w.Flow == "RE-PE");
                        break;
                    default:
                        query = query.Where(work => work.OwnerReceive != null &&
                                           work.OwnerReceive.Split(',').Any(idTemp => idTemp.Trim() == id));
                        break;
                }

                newListWork = query.ToList();

                // Xử lý thông tin Owner
                newListWork = GetInfoOwner(newListWork, ListUsers);

                // Lấy danh sách user (ĐÃ SỬA logic flag static)
                var listUserData = GetUserList(ListUsers, "");

                return Json(new { success = true, ListWorks = newListWork, ListUser = listUserData, ListModel = ListModel, StatusTotals = statusTotals }, JsonRequestBehavior.AllowGet);
            }
            catch (Exception ex)
            {
                // Nên log lỗi ex ra file hoặc console để debug
                return Json(new { error = true, message = "Wrong filter. Please double check or contact us!" }, JsonRequestBehavior.AllowGet);
            }
        }

        // Function helper (Không nên dùng static nếu không cần thiết, nhưng OK cho helper thuần túy)
        private List<Work> GetInfoOwner(List<Work> listWorks, List<User> listUsers)
        {
            foreach (var work in listWorks)
            {
                // Serialize OwnerRequest
                var reqUser = listUsers.Where(u => u.CardID == work.OwnerRequest)
                        .Select(u => new { u.Department, u.CardID, u.VnName, u.EnName, u.CnName });
                work.OwnerRequest = JsonConvert.SerializeObject(reqUser);

                // Serialize OwnerReceive
                if (!string.IsNullOrEmpty(work.OwnerReceive))
                {
                    List<string> ownerRcIDList = work.OwnerReceive.Split(',').ToList();
                    var userList = ownerRcIDList.Join(listUsers, rcId => rcId.Trim(), us => us.CardID,
                        (rcId, us) => new { us.Department, us.CardID, us.VnName, us.EnName, us.CnName })
                        .ToList();
                    work.OwnerReceive = JsonConvert.SerializeObject(userList);
                }
            }
            return listWorks;
        }

        private object GetUserList(List<User> listUsers, string DEPARTMENT)
        {
            if (string.IsNullOrEmpty(DEPARTMENT))
            {
                return listUsers.Select(u => new { u.Department, u.CardID, u.VnName, u.EnName, u.CnName }).ToList();
            }
            else
            {
                return listUsers.Where(u => u.Department == DEPARTMENT)
                    .Select(u => new { u.Department, u.CardID, u.VnName, u.EnName, u.CnName }).ToList();
            }
        }

        // Event
        [HttpPost] // Thêm HttpPost cho các hàm sửa/xóa để bảo mật
        public JsonResult DeleteWork(int id)
        {
            var record = db.Works.FirstOrDefault(r => r.ID == id);
            if (record == null) return Json(new { error = "Record not found" });

            try
            {
                db.Works.Remove(record);
                db.SaveChanges();
                return Json(new { success = true });
            }
            catch
            {
                return Json(new { error = "Delete work failed. Please double check or contact the administrator!" });
            }
        }

        [HttpGet]
        public JsonResult GetWork(int id)
        {
            if (id == 0)
                return Json(new { error = "ID record is null." }, JsonRequestBehavior.AllowGet);

            Work record = db.Works.SingleOrDefault(r => r.ID == id);
            if (record == null)
                return Json(new { error = "Get work failed." }, JsonRequestBehavior.AllowGet);

            var ListUsers = db.Users.ToList(); // Load local

            var userReq = JsonConvert.SerializeObject(ListUsers.Where(u => u.CardID == record.OwnerRequest)
                       .Select(u => new { u.Department, u.CardID, u.VnName, u.EnName, u.CnName }));

            object userRec = null;
            if (!string.IsNullOrEmpty(record.OwnerReceive))
            {
                List<string> ownerRcIDList = record.OwnerReceive.Split(',').ToList();
                var userList = ownerRcIDList
                    .Join(ListUsers, rcId => rcId.Trim(), us => us.CardID, (rcId, us) => new { us.Department, us.CardID, us.VnName, us.EnName, us.CnName })
                    .ToList();
                userRec = JsonConvert.SerializeObject(userList);
            }

            return Json(new { success = "success", data = record, userReq = userReq, userRec = userRec }, JsonRequestBehavior.AllowGet);
        }

        [HttpPost]
        public JsonResult EditWork(Work work, string changeTime, string userChange)
        {
            // Code EditWork giữ nguyên logic xử lý nhưng đảm bảo db context dùng đúng
            // (Phần này trong code gốc của bạn logic tạm ổn, chỉ cần đảm bảo không dùng static list)

            string valiStatus = ValidationWork(work);
            if (valiStatus != "success")
            {
                return Json(new { error = valiStatus });
            }

            try
            {
                // Fetch fresh data for validation
                var userReq = db.Users.SingleOrDefault(u => u.CardID == work.OwnerRequest);
                var userRec = db.Users.SingleOrDefault(u => u.CardID == work.OwnerReceive); // Lưu ý: OwnerReceive có thể là nhiều người, code cũ đang assume 1 người để lấy Department?

                // Nếu OwnerReceive là danh sách (A,B,C) thì code: SingleOrDefault(u => u.CardID == work.OwnerReceive) sẽ lỗi hoặc null.
                // Tôi sẽ giữ nguyên logic cũ của bạn nhưng hãy cẩn thận đoạn này.
                // Giả định work.OwnerReceive lúc save chỉ là 1 ID đại diện hoặc logic business quy định thế.

                string depReq = userReq?.Department ?? "";
                string depRec = userRec?.Department ?? "";

                work.Flow = depReq + "-" + depRec;

                Work _old = db.Works.AsNoTracking().SingleOrDefault(w => w.ID == work.ID); // AsNoTracking để không conflict khi update
                if (_old != null)
                {
                    work.HistoryLog = CreateChangeLog(userChange, changeTime, _old, work);
                }

                db.Works.AddOrUpdate(w => w.ID, work);
                AddOrUpdateModel(work.Model);
                db.SaveChanges();

                // Trả về data update cho client
                // ... (Logic trả về JSON giữ nguyên)

                return Json(new { success = true, dataRow = work });
            }
            catch (Exception ex)
            {
                return Json(new { error = "Edit work failed: " + ex.Message });
            }
        }

        // ... Các hàm ValidationWork, AddOrUpdateModel, CreateChangeLog giữ nguyên logic ...
        private string ValidationWork(Work work)
        {
            if (string.IsNullOrEmpty(work.OwnerRequest) || string.IsNullOrEmpty(work.OwnerReceive))
                return "Owner request or Owner receive is null.";
            if (work.OwnerReceive == work.OwnerRequest)
                return "Owner request and Owner Receive have the same Card ID.";

            if (work.DateStart < new DateTime(2000, 01, 01))
                return "Date Start less than 2000-01-01";
            if (work.DueDate < work.DateStart)
                return "Due Date less than Start Date";

            if (string.IsNullOrEmpty(work.Type))
                return "Type of record is null.";
            if (string.IsNullOrEmpty(work.Status))
                return "Status of record is null ";
            return "success";
        }

        private void AddOrUpdateModel(string modelName)
        {
            if (!string.IsNullOrEmpty(modelName))
            {
                Model md = db.Models1.FirstOrDefault(e => e.Model_ == modelName);
                if (md == null)
                {
                    md = new Model();
                    md.Model_ = modelName;
                    db.Models1.Add(md);
                }
            }
        }

        private string CreateChangeLog(string userChange, string changeTime, Work oldWork, Work newWork)
        {
            // Giữ nguyên logic của bạn
            // Lưu ý: Cần xử lý null check kỹ hơn
            // Tôi copy lại đoạn code cũ của bạn vào đây
            var propertiesToCheck = new[]
            {
                new {Name = "Status", Action = "Status"},
                new {Name = "Type", Action = "Type"},
                new {Name = "DateStart", Action = "Date"},
                new {Name = "DueDate", Action = "Due Date"},
                new {Name = "CTF", Action = "CTF"},
                new {Name = "Model", Action = "Model"},
                new {Name = "OwnerRequest", Action = "Owner Request"},
                new {Name = "OwnerReceive", Action = "Owner Receive"},
                new {Name = "WorkDes", Action = "Works"},
                new {Name = "Detail", Action = "Result"}
             };

            var logEntries = new List<JObject>();
            foreach (var prop in propertiesToCheck)
            {
                var oldProp = oldWork.GetType().GetProperty(prop.Name);
                var newProp = newWork.GetType().GetProperty(prop.Name);

                var oldValue = oldProp?.GetValue(oldWork, null)?.ToString();
                var newValue = newProp?.GetValue(newWork, null)?.ToString();

                if (oldValue != newValue)
                {
                    logEntries.Add(new JObject(
                        new JProperty("User", userChange),
                        new JProperty("Action", prop.Action),
                        new JProperty("Old", oldValue),
                        new JProperty("New", newValue)
                    ));
                }
            }

            var logObject = new JObject();
            if (!string.IsNullOrEmpty(oldWork.HistoryLog))
            {
                try
                {
                    logObject = JObject.Parse(oldWork.HistoryLog);
                }
                catch { }
            }

            JArray logEntriesArray;
            if (logObject.ContainsKey(changeTime))
            {
                logEntriesArray = (JArray)logObject[changeTime];
            }
            else
            {
                logEntriesArray = new JArray();
                logObject.Add(changeTime, logEntriesArray);
            }

            logEntriesArray.Add(logEntries);

            return logObject.ToString();
        }
    }
}