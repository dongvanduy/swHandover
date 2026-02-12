using System;
using System.Linq;
using System.Web;
using System.Web.Mvc;
using System.Web.Routing;

namespace HandOver.Common
{
    public class CustomAuthorizeAttribute : AuthorizeAttribute
    {
        public int RoleNum { get; set; } = 0;
        private readonly TransferWorkEntities db = new TransferWorkEntities();

        public override void OnAuthorization(AuthorizationContext filterContext)
        {
            var httpContext = filterContext.HttpContext;
            var userLogin = httpContext?.Session?[MySession.USER_SESSION];

            // Nếu session bị mất, thử khôi phục từ cookie đăng nhập.
            if (userLogin == null && !TryRestoreSessionFromCookie(httpContext))
            {
                filterContext.Result = new RedirectToRouteResult(new RouteValueDictionary(new
                {
                    controller = "Login",
                    action = "Index",
                    area = "",
                }));
                return;
            }

            var currentUserId = MySession.CurrentUserId;
            if (string.IsNullOrWhiteSpace(currentUserId))
            {
                filterContext.Result = new RedirectToRouteResult(new RouteValueDictionary(new
                {
                    controller = "Login",
                    action = "Index",
                    area = "",
                }));
                return;
            }

            var currentUser = db.Users.SingleOrDefault(u => u.CardID == currentUserId);
            if (currentUser == null || currentUser.Role <= RoleNum)
            {
                filterContext.Result = new RedirectToRouteResult(new RouteValueDictionary(new
                {
                    controller = "Error",
                    action = "Error500",
                    area = "",
                }));
            }
        }

        private bool TryRestoreSessionFromCookie(HttpContextBase httpContext)
        {
            if (httpContext?.Request?.Cookies == null || httpContext.Session == null)
            {
                return false;
            }

            HttpCookie userCookie = httpContext.Request.Cookies["UserCookies"];
            string cardId = (userCookie?["CardID"] ?? "").Trim();
            if (string.IsNullOrWhiteSpace(cardId))
            {
                return false;
            }

            var user = db.Users.SingleOrDefault(u => u.CardID == cardId);
            if (user == null || user.IsActive != 1)
            {
                return false;
            }

            MySession.CurrentUserId = user.CardID;
            MySession.USER_ACTIVE = (int)(user.IsActive ?? 0);
            MySession.USER_ROLE = user.Role;
            httpContext.Session[MySession.USER_SESSION] = user;

            return true;
        }
    }
}
