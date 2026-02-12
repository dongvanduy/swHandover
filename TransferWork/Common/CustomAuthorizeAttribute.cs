using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.Mvc;
using System.Web.Routing;

namespace HandOver.Common
{
    public class CustomAuthorizeAttribute : AuthorizeAttribute
    {
        public int RoleNum { get; set; } = 0;

        // Lưu ý: Không nên khởi tạo DbContext ở cấp class Attribute vì khó quản lý vòng đời (Dispose).
        // Tuy nhiên để sửa nhanh theo cấu trúc hiện tại, tôi sẽ giữ nguyên nhưng sửa logic.

        public override void OnAuthorization(AuthorizationContext filterContext)
        {
            var userLogin = HttpContext.Current.Session[MySession.USER_SESSION];

            // Nếu chưa có session thì bắt đăng nhập:
            if (userLogin == null)
            {
                filterContext.Result = new RedirectToRouteResult(new RouteValueDictionary(new
                {
                    controller = "Login",
                    action = "Index", // Đã sửa action thành Index cho đúng với LoginController
                    area = "",
                }));
                return;
            }
            else
            {
                // Mở connection mới để đảm bảo không bị lỗi context cũ
                using (var db = new TransferWorkEntities())
                {
                    var currentUser = db.Users.SingleOrDefault(u => u.CardID == MySession.CurrentUserId);

                    // FIX LỖI CHÍNH Ở ĐÂY: Sửa <= thành < 
                    // Logic: Nếu Role user nhỏ hơn Role yêu cầu -> Chặn
                    if (currentUser == null || currentUser.Role < RoleNum)
                    {
                        filterContext.Result = new RedirectToRouteResult(new RouteValueDictionary(new
                        {
                            controller = "Error",
                            action = "Error500",
                            area = "",
                        }));
                    }
                }
            }
        }
    }
}