// router.js
// Router logic here

const routes = [
    { path: "/", view: () => import("./views/Home.js"), protected: true },
    { path: "/posts", view: () => import("./views/Home.js"), protected: true },
    { path: "/chat", view: () => import("./views/Chat.js"), protected: true },
    { path: "/thread", view: () => import("./views/Thread.js"), protected: true },
    { path: "/create", view: () => import("./views/Create.js"), protected: true },

    { path: "/login", view: () => import("./views/Login.js") },
    { path: "/register", view: () => import("./views/Register.js") },
    { path: "/logout", view: () => import("./views/Login.js") },
];

// --------------------looking at the path to regex----------------------- and getting params

function pathToRegex(path) {
    return new RegExp("^" + path.replace(/\//g, "\\/").replace(/:\w+/g, "([^\\/]+)") + "$");
}

function getParams(match) {
    const values = match.result.slice(1);
    const keys = Array.from(match.route.path.matchAll(/:(\w+)/g)).map(m => m[1]);
    return Object.fromEntries(keys.map((k, i) => [k, values[i]]));
}

// --------------------look at this later --------------------------------------



export async function checkAuth() {
    const res = await fetch("/api/auth/status", {
        credentials: "include"
    });

    if (!res.ok) return false;

    const data = await res.json();
    return data.authenticated === true;
}


export async function navigateTo(url) {
    history.pushState(null, "", url);
    await router();
}


export async function router() {
    const potentialMatches = routes.map(route => ({
        route,
        result: location.pathname.match(pathToRegex(route.path))
    }));

    //    { {route object}, result}

    let match = potentialMatches.find(m => m.result !== null);

    if (!match) {
        match = { route: { view: () => import("./views/NotFound.js") }, result: [location.pathname] }
    }

    if (match.route.protected) {
        const isAuth = await checkAuth();

        if (!isAuth) {
            history.replaceState(null, "", "/login");
            return router();
        }
    }

    //prevent loged in users from seieng login & register 
    if (match.route.path === "/login" || match.route.path === "/register") {
        const isAuth = await checkAuth();
        if (isAuth) {
            history.replaceState(null, "", "/");
            return router();
        }
    }

    // awaiting the import section
    const viewModule = await match.route.view();
    //some weirdmodule i guess
    const view = viewModule.default;


    //putting the app and calling the function using the params we need


    //it was app
    const app = document.querySelector("#mainarea")
    app.innerHTML = await view(getParams(match))
}

//pathname the location is the currenturl we are going to. and we are checking if it matches
// and once that shit matches, we mark it as match to one of our routes