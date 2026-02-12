using HandOver.Common;
using System;
using System.Data.Entity;
using System.Data.Entity.Migrations;
using System.Globalization;
using System.Linq;
using System.Net.Http;
using System.Threading.Tasks;
using System.Web;
using System.Web.Mvc;

namespace HandOver.Controllers
{
    public class LoginController : Controller
    {
        private readonly TransferWorkEntities db = new TransferWorkEntities();
        private static readonly HttpClient client = new HttpClient();

        // GET: Login
        public ActionResult Index()
        {
            return View();
        }

        [HttpPost]
        public async Task<ActionResult> Login(string CardID, string Password, string RememberLogin)
        {
            CardID = (CardID ?? "").Trim();
            Password = (Password ?? "").Trim();

            if (string.IsNullOrWhiteSpace(CardID) || string.IsNullOrWhiteSpace(Password))
            {
                return Json(new { Status = "Missing Fields" });
            }

            var user = await db.Users.SingleOrDefaultAsync(u => u.CardID == CardID);
            if (user == null)
            {
                return Json(new { Status = "No Card ID" });
            }

            // Nếu password = -1 thì lần đầu login -> lấy HR API để cập nhật
            if (user.Password == "-1")
            {
                string userData = await GetUserDataAsync(CardID);
                if (string.IsNullOrWhiteSpace(userData))
                {
                    return Json(new { Status = "No Card ID" });
                }

                string hireDateRaw = Function.GetTextString(userData, "\"HIREDATE\":\"", "\",\"");
                string cnName = Function.GetTextString(userData, "\"USER_NAME\":\"", "\",\"");
                string gender = Function.GetTextString(userData, "\"SEX\":\"", "\",\"");

                hireDateRaw = (hireDateRaw ?? "").Trim();

                // Hỗ trợ cả 2022/4/20 và 2022/04/20
                var formats = new[] { "yyyy/M/d", "yyyy/MM/dd" };
                if (!DateTime.TryParseExact(
                        hireDateRaw,
                        formats,
                        CultureInfo.InvariantCulture,
                        DateTimeStyles.None,
                        out DateTime dateStart))
                {
                    return Json(new { Status = "HireDate format invalid" });
                }

                // Chuẩn hoá password 8 số: yyyyMMdd (vd 20220420)
                user.Password = dateStart.ToString("yyyyMMdd");
                user.StartDate = dateStart;
                user.CnName = string.IsNullOrWhiteSpace(cnName) ? "N/A" : cnName.Trim();
                user.Gender = string.IsNullOrWhiteSpace(gender) ? "N/A" : gender.Trim();

                db.Users.AddOrUpdate(u => u.CardID, user);
                await db.SaveChangesAsync();
            }

            // So sánh password
            if ((user.Password ?? "").Trim() != Password)
            {
                return Json(new { Status = "Password Wrong" });
            }

            // Login OK
            CreateSession(user);

            // Remember login
            bool remember = false;
            bool.TryParse(RememberLogin, out remember);
            if (remember)
            {
                CreateCookie(user.CardID, user.Password);
            }

            switch ((user.Department ?? "").Trim())
            {
                case "PE":
                    return Json(new { Status = "Success", href = Url.Action("Index", "Works", new { area = "HandoverPE" }) });
                case "RE":
                    return Json(new { Status = "Success", href = Url.Action("Index", "Works", new { area = "HandoverRE" }) });
                default:
                    return Json(new { Status = "Success", href = Url.Action("Index", "Works", new { area = "Handover" }) });
            }
        }

        [HttpPost]
        public JsonResult Register(string CardID, string Password, string ConfirmPassword, string Department, string VnName, string EnName)
        {
            CardID = (CardID ?? "").Trim();
            Password = (Password ?? "").Trim();
            ConfirmPassword = (ConfirmPassword ?? "").Trim();
            Department = (Department ?? "").Trim();
            VnName = (VnName ?? "").Trim();
            EnName = (EnName ?? "").Trim();

            if (string.IsNullOrWhiteSpace(CardID) ||
                string.IsNullOrWhiteSpace(Password) ||
                string.IsNullOrWhiteSpace(ConfirmPassword) ||
                string.IsNullOrWhiteSpace(Department) ||
                string.IsNullOrWhiteSpace(VnName))
            {
                return Json(new { Status = "Missing Fields" });
            }

            if (Password != ConfirmPassword)
            {
                return Json(new { Status = "Confirm Password Wrong" });
            }

            if (db.Users.Any(u => u.CardID == CardID))
            {
                return Json(new { Status = "Card ID Exists" });
            }

            var user = new User
            {
                CardID = CardID,
                Password = Password,
                Department = Department,
                VnName = VnName,
                EnName = string.IsNullOrWhiteSpace(EnName) ? "N/A" : EnName,
                CnName = "N/A",
                Gender = "N/A",
                StartDate = null,
                Role = 3,
                IsActive = 1
            };

            db.Users.Add(user);
            db.SaveChanges();

            return Json(new { Status = "Success" });
        }

        public ActionResult Logout()
        {
            HttpCookie myCookie = new HttpCookie("UserCookies");
            myCookie.Expires = DateTime.Now.AddDays(-1);
            Response.Cookies.Add(myCookie);

            Session.Clear();
            MySession.CurrentUserId = null;
            MySession.USER_ROLE = 0;
            MySession.USER_ACTIVE = 0;

            return RedirectToAction("Index", "Login");
        }

        [HttpPost]
        public JsonResult ChangePass(string id, string oldPass, string newPass, string confirm)
        {
            id = (id ?? "").Trim();
            oldPass = (oldPass ?? "").Trim();
            newPass = (newPass ?? "").Trim();
            confirm = (confirm ?? "").Trim();

            if (id != MySession.CurrentUserId)
            {
                return Json(new { status = "fail" });
            }

            User temp = db.Users.SingleOrDefault(u => u.CardID == id);
            if (temp == null)
            {
                return Json(new { status = "fail" });
            }

            if ((temp.Password ?? "") != oldPass)
            {
                return Json(new { status = "password fail" });
            }

            if (newPass != confirm)
            {
                return Json(new { status = "confirm fail" });
            }

            temp.Password = newPass;
            db.Users.AddOrUpdate(u => u.CardID, temp);
            db.SaveChanges();
            return Json(new { status = "ok" });
        }

        public void CreateSession(User user)
        {
            MySession.CurrentUserId = user.CardID;
            MySession.USER_ACTIVE = (int)user.IsActive;
            MySession.USER_ROLE = user.Role;

            Session[MySession.USER_SESSION] = user;

            Response.Cookies["UserCookies"]["CardID"] = user.CardID;
            Response.Cookies["UserCookies"]["VnName"] = Server.UrlEncode(user.VnName);
            Response.Cookies["UserCookies"]["EnName"] = user.EnName;
            Response.Cookies["UserCookies"]["CnName"] = Server.UrlEncode(user.CnName);
            Response.Cookies["UserCookies"]["Depart"] = user.Department;
            Response.Cookies["UserCookies"]["Role"] = user.Role.ToString();
        }

        public void CreateCookie(string CardID, string Password)
        {
            Response.Cookies["UserCookies"]["Password"] = Function.GetStringMD5(Password);
            Response.Cookies["UserCookies"]["LoginTime"] = DateTime.Now.ToString("yyyy/MM/dd HH:mm:ss"); // sửa MM -> mm
            Response.Cookies["UserCookies"].Expires = DateTime.Now.AddDays(15);
        }

        private async Task<string> GetUserDataAsync(string CardID)
        {
            try
            {
                string url = "http://10.224.69.100:8080/postman/api/hr/getEmpObj?id=" + CardID;
                HttpResponseMessage response = await client.GetAsync(url);
                response.EnsureSuccessStatusCode();
                return await response.Content.ReadAsStringAsync();
            }
            catch (HttpRequestException)
            {
                return "";
            }
        }
    }
}
