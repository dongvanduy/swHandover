using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;

namespace HandOver.Common
{
    public static class MySession
    {
        public const string USER_SESSION = "USER_SESSION";

        private const string USER_ID_KEY = "USER_ID";
        private const string USER_ROLE_KEY = "USER_ROLE";
        private const string USER_ACTIVE_KEY = "USER_ACTIVE";

        public static string CurrentUserId
        {
            get => HttpContext.Current?.Session?[USER_ID_KEY] as string;
            set
            {
                if (HttpContext.Current?.Session != null)
                {
                    HttpContext.Current.Session[USER_ID_KEY] = value;
                }
            }
        }

        public static int USER_ROLE
        {
            get => ConvertToInt(HttpContext.Current?.Session?[USER_ROLE_KEY]);
            set
            {
                if (HttpContext.Current?.Session != null)
                {
                    HttpContext.Current.Session[USER_ROLE_KEY] = value;
                }
            }
        }

        public static int USER_ACTIVE
        {
            get => ConvertToInt(HttpContext.Current?.Session?[USER_ACTIVE_KEY]);
            set
            {
                if (HttpContext.Current?.Session != null)
                {
                    HttpContext.Current.Session[USER_ACTIVE_KEY] = value;
                }
            }
        }

        private static int ConvertToInt(object value)
        {
            if (value == null)
            {
                return 0;
            }

            int parsed;
            return int.TryParse(value.ToString(), out parsed) ? parsed : 0;
        }
    }
}
