window.kcStorage = {
    lsGet: function (key) {
        return localStorage.getItem(key);
    },
    lsSet: function (key, value) {
        localStorage.setItem(key, value);
    },
    lsRemove: function (key) {
        localStorage.removeItem(key);
    },
    cookieGet: function (name) {
        var match = document.cookie.match(new RegExp('(?:^|;\\s*)' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)'));
        return match ? match[1] : null;
    },
    cookieSet: function (name, value, days) {
        var expires = '';
        if (days) {
            var date = new Date();
            date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
            expires = '; expires=' + date.toUTCString();
        }
        document.cookie = name + '=' + (value || '') + expires + '; path=/; SameSite=Lax';
    }
};
