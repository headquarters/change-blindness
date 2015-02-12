/*
 * Copyright (c) 2011, Yahoo! Inc.  All rights reserved.
 * Copyright (c) 2012, Log-Normal, Inc.  All rights reserved.
 * Copyright (c) 2014, SOASTA, Inc. All rights reserved.
 * Copyrights licensed under the BSD License. See the accompanying LICENSE.txt file for terms.
 */

/**
\file boomerang.js
boomerang measures various performance characteristics of your user's browsing
experience and beacons it back to your server.

\details
To use this you'll need a web site, lots of users and the ability to do
something with the data you collect.  How you collect the data is up to
you, but we have a few ideas.
*/

/*eslint-env browser*/
/*global BOOMR:true, BOOMR_start:true, BOOMR_lstart:true, console:false*/
/*eslint no-mixed-spaces-and-tabs:[2, true], console:0, camelcase:0, strict:0, quotes:[2, "double", "avoid-escape"], new-cap:0*/
/*eslint space-infix-ops:0, no-console:0, no-delete-var:0, no-space-before-semi:0*/

// Measure the time the script started
// This has to be global so that we don't wait for the entire
// BOOMR function to download and execute before measuring the
// time.  We also declare it without `var` so that we can later
// `delete` it.  This is the only way that works on Internet Explorer
BOOMR_start = new Date().getTime();

/**
 Check the value of document.domain and fix it if incorrect.
 This function is run at the top of boomerang, and then whenever
 init() is called.  If boomerang is running within an iframe, this
 function checks to see if it can access elements in the parent
 iframe.  If not, it will fudge around with document.domain until
 it finds a value that works.

 This allows customers to change the value of document.domain at
 any point within their page's load process, and we will adapt to
 it.
 */
function BOOMR_check_doc_domain(domain) {
	/*eslint no-unused-vars:0*/
	var test;

	// If domain is not passed in, then this is a global call
	// domain is only passed in if we call ourselves, so we
	// skip the frame check at that point
	if(!domain) {
		// If we're running in the main window, then we don't need this
		if(window.parent === window || !document.getElementById("boomr-if-as")) {
			return;// true;	// nothing to do
		}

		domain = document.domain;
	}

	if(domain.indexOf(".") === -1) {
		return;// false;	// not okay, but we did our best
	}

	// 1. Test without setting document.domain
	try {
		test = window.parent.document;
		return;// test !== undefined;	// all okay
	}
	// 2. Test with document.domain
	catch(err) {
		document.domain = domain;
	}
	try {
		test = window.parent.document;
		return;// test !== undefined;	// all okay
	}
	// 3. Strip off leading part and try again
	catch(err) {
		domain = domain.replace(/^[\w\-]+\./, "");
	}

	BOOMR_check_doc_domain(domain);
}

BOOMR_check_doc_domain();


// beaconing section
// the parameter is the window
(function(w) {

var impl, boomr, d, myurl, createCustomEvent, dispatchEvent, visibilityState, visibilityChange;

// This is the only block where we use document without the w. qualifier
if(w.parent !== w
		&& document.getElementById("boomr-if-as")
		&& document.getElementById("boomr-if-as").nodeName.toLowerCase() === "script") {
	w = w.parent;
	myurl = document.getElementById("boomr-if-as").src;
}

d = w.document;

// Short namespace because I don't want to keep typing BOOMERANG
if(!w.BOOMR) { w.BOOMR = {}; }
BOOMR = w.BOOMR;
// don't allow this code to be included twice
if(BOOMR.version) {
	return;
}

BOOMR.version = "0.9.1422480010";
BOOMR.window = w;

if (!BOOMR.plugins) { BOOMR.plugins = {}; }

// CustomEvent proxy for IE9 & 10 from https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent
(function() {
	try {
		if (new w.CustomEvent("CustomEvent") !== undefined) {
			createCustomEvent = function (e_name, params) {
				return new w.CustomEvent(e_name, params);
			};
		}
	}
	catch(ignore) {
	}

	try {
		if (!createCustomEvent && d.createEvent && d.createEvent( "CustomEvent" )) {
			createCustomEvent = function (e_name, params) {
				var evt = d.createEvent( "CustomEvent" );
				params = params || { cancelable: false, bubbles: false };
				evt.initCustomEvent( e_name, params.bubbles, params.cancelable, params.detail );

				return evt;
			};
		}
	}
	catch(ignore) {
	}

	if (!createCustomEvent && d.createEventObject) {
		createCustomEvent = function (e_name, params) {
			var evt = d.createEventObject();
			evt.type = evt.propertyName = e_name;
			evt.detail = params.detail;

			return evt;
		};
	}

	if(!createCustomEvent) {
		createCustomEvent = function() { return undefined; };
	}
}());

dispatchEvent = function(e_name, e_data) {
	var ev = createCustomEvent(e_name, {"detail": e_data});
	if (!ev) {
		return;
	}

	BOOMR.setImmediate(function() {
		if(d.dispatchEvent) {
			d.dispatchEvent(ev);
		}
		else if(d.fireEvent) {
			d.fireEvent("onpropertychange", ev);
		}
	});
};

// visibilitychange is useful to detect if the page loaded through prerender
// or if the page never became visible
// http://www.w3.org/TR/2011/WD-page-visibility-20110602/
// http://www.nczonline.net/blog/2011/08/09/introduction-to-the-page-visibility-api/
// https://developer.mozilla.org/en-US/docs/Web/Guide/User_experience/Using_the_Page_Visibility_API

// Set the name of the hidden property and the change event for visibility
if (typeof document.hidden !== "undefined") { // Opera 12.10 and Firefox 18 and later support 
	visibilityState = "visibilityState";
	visibilityChange = "visibilitychange";
}
else if (typeof document.mozHidden !== "undefined") {
	visibilityState = "mozVisibilityState";
	visibilityChange = "mozvisibilitychange";
}
else if (typeof document.msHidden !== "undefined") {
	visibilityState = "msVisibilityState";
	visibilityChange = "msvisibilitychange";
}
else if (typeof document.webkitHidden !== "undefined") {
	visibilityState = "webkitVisibilityState";
	visibilityChange = "webkitvisibilitychange";
}


// impl is a private object not reachable from outside the BOOMR object
// users can set properties by passing in to the init() method
impl = {
	// properties
	beacon_url: "",
	// beacon request method, either GET, POST or AUTO. AUTO will check the
	// request size then use GET if the request URL is less than 2000 chars
	// otherwise it will fall back to a POST request.
	beacon_type: "AUTO",
	// strip out everything except last two parts of hostname.
	// This doesn't work well for domains that end with a country tld,
	// but we allow the developer to override site_domain for that.
	// You can disable all cookies by setting site_domain to a falsy value
	site_domain: w.location.hostname.
				replace(/.*?([^.]+\.[^.]+)\.?$/, "$1").
				toLowerCase(),
	//! User's ip address determined on the server.  Used for the BA cookie
	user_ip: "",

	strip_query_string: false,

	onloadfired: false,

	handlers_attached: false,
	events: {
		"page_ready": [],
		"page_unload": [],
		"dom_loaded": [],
		"visibility_changed": [],
		"before_beacon": [],
		"onbeacon": [],
		"xhr_load": [],
		"click": [],
		"form_submit": []
	},

	public_events: {
		"before_beacon": "onBeforeBoomerangBeacon",
		"onbeacon": "onBoomerangBeacon",
		"onboomerangloaded": "onBoomerangLoaded"
	},

	vars: {},

	errors: {},

	disabled_plugins: {},

	xb_handler: function(type) {
		return function(ev) {
			var target;
			if (!ev) { ev = w.event; }
			if (ev.target) { target = ev.target; }
			else if (ev.srcElement) { target = ev.srcElement; }
			if (target.nodeType === 3) {// defeat Safari bug
				target = target.parentNode;
			}

			// don't capture events on flash objects
			// because of context slowdowns in PepperFlash
			if(target && target.nodeName.toUpperCase() === "OBJECT" && target.type === "application/x-shockwave-flash") {
				return;
			}
			impl.fireEvent(type, target);
		};
	},

	fireEvent: function(e_name, data) {
		var i, handler, handlers;

		e_name = e_name.toLowerCase();

		if(!this.events.hasOwnProperty(e_name)) {
			return false;
		}

		if (this.public_events.hasOwnProperty(e_name)) {
			dispatchEvent(this.public_events[e_name], data);
		}

		handlers = this.events[e_name];

		for(i=0; i<handlers.length; i++) {
			try {
				handler = handlers[i];
				handler.fn.call(handler.scope, data, handler.cb_data);
			}
			catch(err) {
				BOOMR.addError(err, "fireEvent." + e_name + "<" + i + ">");
			}
		}

		return true;
	}
};


// We create a boomr object and then copy all its properties to BOOMR so that
// we don't overwrite anything additional that was added to BOOMR before this
// was called... for example, a plugin.
boomr = {
	t_lstart: null,
	t_start: BOOMR_start,
	t_end: null,

	url: myurl,

	// Utility functions
	utils: {
		objectToString: function(o, separator, nest_level) {
			var value = [], k;

			if(!o || typeof o !== "object") {
				return o;
			}
			if(separator === undefined) {
				separator="\n\t";
			}
			if(!nest_level) {
				nest_level=0;
			}

			if (Object.prototype.toString.call(o) === "[object Array]") {
				for(k=0; k<o.length; k++) {
					if (nest_level > 0 && o[k] !== null && typeof o[k] === "object") {
						value.push(
							this.objectToString(
								o[k],
								separator + (separator === "\n\t" ? "\t" : ""),
								nest_level-1
							)
						);
					}
					else {
						if (separator === "&") {
							value.push(encodeURIComponent(o[k]));
						}
						else {
							value.push(o[k]);
						}
					}
				}
				separator = ",";
			}
			else {
				for(k in o) {
					if(Object.prototype.hasOwnProperty.call(o, k)) {
						if (nest_level > 0 && o[k] !== null && typeof o[k] === "object") {
							value.push(encodeURIComponent(k) + "=" +
								this.objectToString(
									o[k],
									separator + (separator === "\n\t" ? "\t" : ""),
									nest_level-1
								)
							);
						}
						else {
							if (separator === "&") {
								value.push(encodeURIComponent(k) + "=" + encodeURIComponent(o[k]));
							}
							else {
								value.push(k + "=" + o[k]);
							}
						}
					}
				}
			}

			return value.join(separator);
		},

		getCookie: function(name) {
			if(!name) {
				return null;
			}

			name = " " + name + "=";

			var i, cookies;
			cookies = " " + d.cookie + ";";
			if ( (i=cookies.indexOf(name)) >= 0 ) {
				i += name.length;
				cookies = cookies.substring(i, cookies.indexOf(";", i));
				return cookies;
			}

			return null;
		},

		setCookie: function(name, subcookies, max_age) {
			var value, nameval, savedval, c, exp;

			if(!name || !impl.site_domain) {
				BOOMR.debug("No cookie name or site domain: " + name + "/" + impl.site_domain);
				return false;
			}

			value = this.objectToString(subcookies, "&");
			nameval = name + "=" + value;

			c = [nameval, "path=/", "domain=" + impl.site_domain];
			if(max_age) {
				exp = new Date();
				exp.setTime(exp.getTime() + max_age*1000);
				exp = exp.toGMTString();
				c.push("expires=" + exp);
			}

			if ( nameval.length < 500 ) {
				d.cookie = c.join("; ");
				// confirm cookie was set (could be blocked by user's settings, etc.)
				savedval = this.getCookie(name);
				if(value === savedval) {
					return true;
				}
				BOOMR.warn("Saved cookie value doesn't match what we tried to set:\n" + value + "\n" + savedval);
			}
			else {
				BOOMR.warn("Cookie too long: " + nameval.length + " " + nameval);
			}

			return false;
		},

		getSubCookies: function(cookie) {
			var cookies_a,
			    i, l, kv,
			    gotcookies=false,
			    cookies={};

			if(!cookie) {
				return null;
			}

			if(typeof cookie !== "string") {
				BOOMR.debug("TypeError: cookie is not a string: " + typeof cookie);
				return null;
			}

			cookies_a = cookie.split("&");

			for(i=0, l=cookies_a.length; i<l; i++) {
				kv = cookies_a[i].split("=");
				if(kv[0]) {
					kv.push("");	// just in case there's no value
					cookies[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1]);
					gotcookies=true;
				}
			}

			return gotcookies ? cookies : null;
		},

		removeCookie: function(name) {
			return this.setCookie(name, {}, -86400);
		},

		cleanupURL: function(url) {
			if (!url) {
				return "";
			}
			if(impl.strip_query_string) {
				return url.replace(/\?.*/, "?qs-redacted");
			}
			return url;
		},

		hashQueryString: function(url, stripHash) {
			if(!url) {
				return url;
			}
			if(url.match(/^\/\//)) {
				url = location.protocol + url;
			}
			if(!url.match(/^(https?|file):/)) {
				BOOMR.error("Passed in URL is invalid: " + url);
				return "";
			}
			if(stripHash) {
				url = url.replace(/#.*/, "");
			}
			if(!BOOMR.utils.MD5) {
				return url;
			}
			return url.replace(/\?([^#]*)/, function(m0, m1) { return "?" + (m1.length > 10 ? BOOMR.utils.MD5(m1) : m1); });
		},

		pluginConfig: function(o, config, plugin_name, properties) {
			var i, props=0;

			if(!config || !config[plugin_name]) {
				return false;
			}

			for(i=0; i<properties.length; i++) {
				if(config[plugin_name][properties[i]] !== undefined) {
					o[properties[i]] = config[plugin_name][properties[i]];
					props++;
				}
			}

			return (props>0);
		},

		/**
		 Add a MutationObserver for a given element and terminate after `timeout`ms.
		 @param el		DOM element to watch for mutations
		 @param config		MutationObserverInit object (https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver#MutationObserverInit)
		 @param timeout		Number of milliseconds of no mutations after which the observer should be automatically disconnected
					If set to a falsy value, the observer will wait indefinitely for Mutations.
		 @param callback	Callback function to call either on timeout or if mutations are detected.  The signature of this method is:
						function(mutations, callback_data)
					Where:
						mutations is the list of mutations detected by the observer or `undefined` if the observer timed out
						callback_data is the passed in `callback_data` parameter without modifications

					The callback function may return a falsy value to disconnect the observer after it returns, or a truthy value to
					keep watching for mutations. If the return value is numeric and greater than 0, then this will be the new timeout
					if it is boolean instead, then the timeout will not fire any more so the caller MUST call disconnect() at some point
		 @param callback_data	Any data to be passed to the callback function as its second parameter
		 @param callback_ctx	An object that represents the `this` object of the `callback` method.  Leave unset the callback function is not a method of an object

		 @returns	- `null` if a MutationObserver could not be created OR
				- An object containing the observer and the timer object:
				  { observer: <MutationObserver>, timer: <Timeout Timer if any> }

				The caller can use this to disconnect the observer at any point by calling `retval.observer.disconnect()`
				Note that the caller should first check to see if `retval.observer` is set before calling `disconnect()` as it may
				have been cleared automatically.
		 */
		addObserver: function(el, config, timeout, callback, callback_data, callback_ctx) {
			var o = {observer: null, timer: null};

			if(!window.MutationObserver || !callback || !el) {
				return null;
			}

			function done(mutations) {
				var run_again=false;

				if(o.timer) {
					clearTimeout(o.timer);
					o.timer = null;
				}

				if(callback) {
					run_again = callback.call(callback_ctx, mutations, callback_data);

					if(!run_again) {
						callback = null;
					}
				}

				if(!run_again && o.observer) {
					o.observer.disconnect();
					o.observer = null;
				}

				if(typeof run_again === "number" && run_again > 0) {
					o.timer = setTimeout(done, run_again);
				}
			}

			o.observer = new MutationObserver(done);

			if(timeout) {
				o.timer = setTimeout(done, o.timeout);
			}

			o.observer.observe(el, config);

			return o;
		},

		addListener: function(el, type, fn) {
			if (el.addEventListener) {
				el.addEventListener(type, fn, false);
			} else if (el.attachEvent) {
				el.attachEvent( "on" + type, fn );
			}
		},

		removeListener: function (el, type, fn) {
			if (el.removeEventListener) {
				el.removeEventListener(type, fn, false);
			} else if (el.detachEvent) {
				el.detachEvent("on" + type, fn);
			}
		},

		pushVars: function (form, vars, prefix) {
			var k, i, l=0, input;

			for(k in vars) {
				if(vars.hasOwnProperty(k)) {
					if(Object.prototype.toString.call(vars[k]) === "[object Array]") {
						for(i = 0; i < vars[k].length; ++i) {
							l += BOOMR.utils.pushVars(form, vars[k][i], k + "[" + i + "]");
						}
					} else {
						input = document.createElement("input");
						input.name = (prefix ? (prefix + "[" + k + "]") : k);
						input.value = (vars[k]===undefined || vars[k]===null ? "" : vars[k]);

						form.appendChild(input);

						l += encodeURIComponent(input.name).length + encodeURIComponent(input.value).length + 2;
					}
				}
			}

			return l;
		},

		sendData: function (form, method) {
			var input  = document.createElement("input"),
			    urls = [ impl.beacon_url ];

			form.method = method;
			form.id = "beacon_form";

			// TODO: Determine if we want to send as JSON
			//if (window.JSON) {
			//	form.innerHTML = "";
			//	form.enctype = "text/plain";
			//	input.name = "data";
			//	input.value = JSON.stringify(impl.vars);
			//	form.appendChild(input);
			//} else {
				form.enctype = "application/x-www-form-urlencoded";
			//}

			if(impl.secondary_beacons && impl.secondary_beacons.length) {
				urls.push.apply(urls, impl.secondary_beacons);
			}


			function remove(id) {
				var el = document.getElementById(id);
				if (el) {
					el.parentNode.removeChild(el);
				}
			}

			function submit() {
				var iframe,
				    name = "boomerang_post-" + encodeURIComponent(form.action) + "-" + Math.random();

				// ref: http://terminalapp.net/submitting-a-form-with-target-set-to-a-script-generated-iframe-on-ie/
				try {
					iframe = document.createElement('<iframe name="' + name + '">');	// IE <= 8
				}
				catch (ignore) {
					iframe = document.createElement("iframe");				// everything else
				}

				form.action = urls.shift();
				form.target = iframe.name = iframe.id = name;
				iframe.style.display = form.style.display = "none";
				iframe.src="javascript:false";

				remove(iframe.id);
				remove(form.id);

				document.body.appendChild(iframe);
				document.body.appendChild(form);

				form.submit();

				if (urls.length) {
					BOOMR.setImmediate(submit);
				}

				setTimeout(function() { remove(iframe.id); }, 10000);
			}

			submit();
		}
	},

	init: function(config) {
		var i, k,
		    properties = ["beacon_url", "beacon_type", "site_domain", "user_ip", "strip_query_string", "secondary_beacons"];

		BOOMR_check_doc_domain();

		if(!config) {
			config = {};
		}

		for(i=0; i<properties.length; i++) {
			if(config[properties[i]] !== undefined) {
				impl[properties[i]] = config[properties[i]];
			}
		}

		if(config.log !== undefined) {
			this.log = config.log;
		}
		if(!this.log) {
			this.log = function(/* m,l,s */) {};
		}

		for(k in this.plugins) {
			if(this.plugins.hasOwnProperty(k)) {
				// config[plugin].enabled has been set to false
				if( config[k]
					&& config[k].hasOwnProperty("enabled")
					&& config[k].enabled === false
				) {
					impl.disabled_plugins[k] = 1;
					continue;
				}

				// plugin was previously disabled but is now enabled
				if(impl.disabled_plugins[k]) {
					delete impl.disabled_plugins[k];
				}

				// plugin exists and has an init method
				if(typeof this.plugins[k].init === "function") {
					try {
						this.plugins[k].init(config);
					}
					catch(err) {
						BOOMR.addError(err, k + ".init");
					}
				}
			}
		}

		if(impl.handlers_attached) {
			return this;
		}

		// The developer can override onload by setting autorun to false
		if(!impl.onloadfired && (config.autorun === undefined || config.autorun !== false)) {
			if(d.readyState && d.readyState === "complete") {
				BOOMR.loadedLate = true;
				this.setImmediate(BOOMR.page_ready, null, null, BOOMR);
			}
			else {
				if(w.onpagehide || w.onpagehide === null) {
					BOOMR.utils.addListener(w, "pageshow", BOOMR.page_ready);
				}
				else {
					BOOMR.utils.addListener(w, "load", BOOMR.page_ready);
				}
			}
		}

		BOOMR.utils.addListener(w, "DOMContentLoaded", function() { impl.fireEvent("dom_loaded"); });

		(function() {
			var forms, iterator;
			if(visibilityChange !== undefined) {
				BOOMR.utils.addListener(d, visibilityChange, function() { impl.fireEvent("visibility_changed"); });

				// record the last time each visibility state occurred
				BOOMR.subscribe("visibility_changed", function() {
					BOOMR.lastVisibilityEvent[BOOMR.visibilityState()] = BOOMR.now();
				});
			}

			BOOMR.utils.addListener(d, "mouseup", impl.xb_handler("click"));

			forms = d.getElementsByTagName("form");
			for(iterator = 0; iterator < forms.length; iterator++) {
				BOOMR.utils.addListener(forms[iterator], "submit", impl.xb_handler("form_submit"));
			}

			if(!w.onpagehide && w.onpagehide !== null) {
				// This must be the last one to fire
				// We only clear w on browsers that don't support onpagehide because
				// those that do are new enough to not have memory leak problems of
				// some older browsers
				BOOMR.utils.addListener(w, "unload", function() { BOOMR.window=w=null; });
			}
		}());

		impl.handlers_attached = true;
		return this;
	},

	// The page dev calls this method when they determine the page is usable.
	// Only call this if autorun is explicitly set to false
	page_ready: function(ev) {
		if (!ev) { ev = w.event; }
		if (!ev) { ev = { name: "load" }; }
		if(impl.onloadfired) {
			return this;
		}
		impl.fireEvent("page_ready", ev);
		impl.onloadfired = true;
		return this;
	},

	setImmediate: function(fn, data, cb_data, cb_scope) {
		var cb = function() {
			fn.call(cb_scope || null, data, cb_data || {});
			cb=null;
		};

		if(w.setImmediate) {
			w.setImmediate(cb);
		}
		else if(w.msSetImmediate) {
			w.msSetImmediate(cb);
		}
		else if(w.webkitSetImmediate) {
			w.webkitSetImmediate(cb);
		}
		else if(w.mozSetImmediate) {
			w.mozSetImmediate(cb);
		}
		else {
			setTimeout(cb, 10);
		}
	},

	now: (window.performance && window.performance.now ? function() { return Math.round(window.performance.now() + window.performance.timing.navigationStart); } : Date.now || function() { return new Date().getTime(); }),

	visibilityState: ( visibilityState === undefined ? function() { return "visible"; } : function() { return d[visibilityState]; } ),

	lastVisibilityEvent: {},

	subscribe: function(e_name, fn, cb_data, cb_scope) {
		var i, handler, ev, unload_handler;

		e_name = e_name.toLowerCase();

		if(!impl.events.hasOwnProperty(e_name)) {
			return this;
		}

		ev = impl.events[e_name];

		// don't allow a handler to be attached more than once to the same event
		for(i=0; i<ev.length; i++) {
			handler = ev[i];
			if(handler.fn === fn && handler.cb_data === cb_data && handler.scope === cb_scope) {
				return this;
			}
		}
		ev.push({ "fn": fn, "cb_data": cb_data || {}, "scope": cb_scope || null });

		// attaching to page_ready after onload fires, so call soon
		if(e_name === "page_ready" && impl.onloadfired) {
			this.setImmediate(fn, null, cb_data, cb_scope);
		}

		// Attach unload handlers directly to the window.onunload and
		// window.onbeforeunload events. The first of the two to fire will clear
		// fn so that the second doesn't fire. We do this because technically
		// onbeforeunload is the right event to fire, but all browsers don't
		// support it.  This allows us to fall back to onunload when onbeforeunload
		// isn't implemented
		if(e_name === "page_unload") {
			unload_handler = function(ev) {
							if(fn) {
								fn.call(cb_scope, ev || w.event, cb_data);
							}
						};
			// pagehide is for iOS devices
			// see http://www.webkit.org/blog/516/webkit-page-cache-ii-the-unload-event/
			if(w.onpagehide || w.onpagehide === null) {
				BOOMR.utils.addListener(w, "pagehide", unload_handler);
			}
			else {
				BOOMR.utils.addListener(w, "unload", unload_handler);
			}
			BOOMR.utils.addListener(w, "beforeunload", unload_handler);
		}

		return this;
	},

	addError: function(err, src, extra) {
		if (typeof err !== "string") {
			err = String(err);
		}
		if (src !== undefined) {
			err = "[" + src + ":" + BOOMR.now() + "] " + err;
		}
		if (extra) {
			err += ":: " + extra;
		}

		if (impl.errors[err]) {
			impl.errors[err]++;
		}
		else {
			impl.errors[err] = 1;
		}
	},

	addVar: function(name, value) {
		if(typeof name === "string") {
			impl.vars[name] = value;
		}
		else if(typeof name === "object") {
			var o = name, k;
			for(k in o) {
				if(o.hasOwnProperty(k)) {
					impl.vars[k] = o[k];
				}
			}
		}
		return this;
	},

	removeVar: function(arg0) {
		var i, params;
		if(!arguments.length) {
			return this;
		}

		if(arguments.length === 1
				&& Object.prototype.toString.apply(arg0) === "[object Array]") {
			params = arg0;
		}
		else {
			params = arguments;
		}

		for(i=0; i<params.length; i++) {
			if(impl.vars.hasOwnProperty(params[i])) {
				delete impl.vars[params[i]];
			}
		}

		return this;
	},

	hasVar: function(name) {
		return impl.vars.hasOwnProperty(name);
	},

	requestStart: function(name) {
		var t_start = BOOMR.now();
		BOOMR.plugins.RT.startTimer("xhr_" + name, t_start);

		return {
			loaded: function(data) {
				BOOMR.responseEnd(name, t_start, data);
			}
		};
	},

	responseEnd: function(name, t_start, data) {
		if(typeof name === "object" && name.url) {
			impl.fireEvent("xhr_load", name);
		}
		else {
			BOOMR.plugins.RT.startTimer("xhr_" + name, t_start);
			impl.fireEvent("xhr_load", {
				"name": "xhr_" + name,
				"data": data
			});
		}
	},

	sendBeacon: function() {
		var k, form, furl, img, length, errors=[];

		BOOMR.debug("Checking if we can send beacon");

		// At this point someone is ready to send the beacon.  We send
		// the beacon only if all plugins have finished doing what they
		// wanted to do
		for(k in this.plugins) {
			if(this.plugins.hasOwnProperty(k)) {
				if(impl.disabled_plugins[k]) {
					continue;
				}
				if(!this.plugins[k].is_complete()) {
					BOOMR.debug("Plugin " + k + " is not complete, deferring beacon send");
					return false;
				}
			}
		}

		// use d.URL instead of location.href because of a safari bug
		impl.vars.pgu = BOOMR.utils.cleanupURL(d.URL.replace(/#.*/, ""));
		if(!impl.vars.u) {
			impl.vars.u = impl.vars.pgu;
		}

		if(impl.vars.pgu === impl.vars.u) {
			delete impl.vars.pgu;
		}

		impl.vars.v = BOOMR.version;

		if(BOOMR.visibilityState()) {
			impl.vars["vis.st"] = BOOMR.visibilityState();
			if(BOOMR.lastVisibilityEvent.visible) {
				impl.vars["vis.lv"] = BOOMR.now() - BOOMR.lastVisibilityEvent.visible;
			}
			if(BOOMR.lastVisibilityEvent.hidden) {
				impl.vars["vis.lh"] = BOOMR.now() - BOOMR.lastVisibilityEvent.hidden;
			}
		}

		if(w !== window) {
			impl.vars["if"] = "";
		}

		for (k in impl.errors) {
			if (impl.errors.hasOwnProperty(k)) {
				errors.push(k + (impl.errors[k] > 1 ? " (*" + impl.errors[k] + ")" : ""));
			}
		}

		if(errors.length > 0) {
			impl.vars.errors = errors.join("\n");
		}

		impl.errors = {};

		// If we reach here, all plugins have completed
		impl.fireEvent("before_beacon", impl.vars);

		// Don't send a beacon if no beacon_url has been set
		// you would do this if you want to do some fancy beacon handling
		// in the `before_beacon` event instead of a simple GET request
		BOOMR.debug("Ready to send beacon: " + BOOMR.utils.objectToString(impl.vars));
		if(!impl.beacon_url) {
			BOOMR.debug("No beacon URL, so skipping.");
			return true;
		}

		form = document.createElement("form");
		length = BOOMR.utils.pushVars(form, impl.vars);

		// If we reach here, we've transferred all vars to the beacon URL.
		impl.fireEvent("onbeacon", impl.vars);

		if(!length) {
			// do not make the request if there is no data
			return this;
		}

		// using 2000 here as a de facto maximum URL length based on:
		// http://stackoverflow.com/questions/417142/what-is-the-maximum-length-of-a-url-in-different-browsers
		BOOMR.utils.sendData(form, impl.beacon_type === "AUTO" ? (length > 2000 ? "POST" : "GET") : "POST");

		return true;
	}

};

delete BOOMR_start;

if(typeof BOOMR_lstart === "number") {
	boomr.t_lstart = BOOMR_lstart;
	delete BOOMR_lstart;
}
else if(typeof BOOMR.window.BOOMR_lstart === "number") {
	boomr.t_lstart = BOOMR.window.BOOMR_lstart;
}

(function() {
	var make_logger;

	if(typeof console === "object" && console.log !== undefined) {
		boomr.log = function(m,l,s) { console.log(s + ": [" + l + "] " + m); };
	}

	make_logger = function(l) {
		return function(m, s) {
			this.log(m, l, "boomerang" + (s?"."+s:""));
			return this;
		};
	};

	boomr.debug = make_logger("debug");
	boomr.info = make_logger("info");
	boomr.warn = make_logger("warn");
	boomr.error = make_logger("error");
}());


(function() {
var ident;
for(ident in boomr) {
	if(boomr.hasOwnProperty(ident)) {
		BOOMR[ident] = boomr[ident];
	}
}
if (!BOOMR.xhr_excludes) {
	//! URLs to exclude from automatic XHR instrumentation
	BOOMR.xhr_excludes={};
}

}());

dispatchEvent("onBoomerangLoaded", { "BOOMR": BOOMR } );

}(window));

// end of boomerang beaconing section
/*
 * Copyright (c) 2011, Yahoo! Inc.  All rights reserved.
 * Copyright (c) 2012, Log-Normal, Inc.  All rights reserved.
 * Copyrights licensed under the BSD License. See the accompanying LICENSE.txt file for terms.
 */

// This is the Bandwidth & Latency plugin abbreviated to BW
(function() {
var impl, images;

BOOMR = BOOMR || {};
BOOMR.plugins = BOOMR.plugins || {};
if(BOOMR.plugins.BW) {
	return;
}

// We choose image sizes so that we can narrow down on a bandwidth range as
// soon as possible the sizes chosen correspond to bandwidth values of
// 14-64kbps, 64-256kbps, 256-1024kbps, 1-2Mbps, 2-8Mbps, 8-30Mbps & 30Mbps+
// Anything below 14kbps will probably timeout before the test completes
// Anything over 60Mbps will probably be unreliable since latency will make up
// the largest part of download time. If you want to extend this further to
// cover 100Mbps & 1Gbps networks, use image sizes of 19,200,000 & 153,600,000
// bytes respectively
// See https://spreadsheets.google.com/ccc?key=0AplxPyCzmQi6dDRBN2JEd190N1hhV1N5cHQtUVdBMUE&hl=en_GB
// for a spreadsheet with the details
images=[
	{ name: "image-0.png", size: 11483, timeout: 1400 },
	{ name: "image-1.png", size: 40658, timeout: 1200 },
	{ name: "image-2.png", size: 164897, timeout: 1300 },
	{ name: "image-3.png", size: 381756, timeout: 1500 },
	{ name: "image-4.png", size: 1234664, timeout: 1200 },
	{ name: "image-5.png", size: 4509613, timeout: 1200 },
	{ name: "image-6.png", size: 9084559, timeout: 1200 }
];

images.end = images.length;
images.start = 0;

// abuse arrays to do the latency test simply because it avoids a bunch of
// branches in the rest of the code.
// I'm sorry Douglas
images.l = { name: "image-l.gif", size: 35, timeout: 1000 };

// private object
impl = {
	// properties
	base_url: "",
	timeout: 15000,
	nruns: 5,
	latency_runs: 10,
	user_ip: "",
	test_https: false,
	cookie_exp: 7*86400,
	cookie: "BA",

	// state
	results: [],
	latencies: [],
	latency: null,
	runs_left: 0,
	aborted: false,
	complete: true,		// defaults to true so we don't block other plugins if this cannot start.
				// init sets it to false
	running: false,
	initialized: false,

	// methods

	// numeric comparator.  Returns negative number if a < b, positive if a > b and 0 if they're equal
	// used to sort an array numerically
	ncmp: function(a, b) { return (a-b); },

	// Calculate the interquartile range of an array of data points
	iqr: function(a)
	{
		var l = a.length-1, q1, q3, fw, b = [], i;

		q1 = (a[Math.floor(l*0.25)] + a[Math.ceil(l*0.25)])/2;
		q3 = (a[Math.floor(l*0.75)] + a[Math.ceil(l*0.75)])/2;

		fw = (q3-q1)*1.5;

		// fw === 0 => all items are identical, so no need to filter
		if (fw === 0) {
			return a;
		}

		l++;

		for(i=0; i<l && a[i] < q3+fw; i++) {
			if(a[i] > q1-fw) {
				b.push(a[i]);
			}
		}

		return b;
	},

	calc_latency: function()
	{
		var	i, n,
			sum=0, sumsq=0,
			amean, median,
			std_dev, std_err,
			lat_filtered;

		// We ignore the first since it paid the price of DNS lookup, TCP connect
		// and slow start
		this.latencies.shift();

		// We first do IQR filtering and use the resulting data set
		// for all calculations
		lat_filtered = this.iqr(this.latencies.sort(this.ncmp));
		n = lat_filtered.length;

		BOOMR.debug("latencies: " + this.latencies, "bw");
		BOOMR.debug("lat_filtered: " + lat_filtered, "bw");

		// First we get the arithmetic mean, standard deviation and standard error
		for(i=0; i<n; i++) {
			sum += lat_filtered[i];
			sumsq += lat_filtered[i] * lat_filtered[i];
		}

		amean = Math.round(sum / n);

		std_dev = Math.sqrt( sumsq/n - sum*sum/(n*n));

		// See http://en.wikipedia.org/wiki/1.96 and http://en.wikipedia.org/wiki/Standard_error_%28statistics%29
		std_err = (1.96 * std_dev/Math.sqrt(n)).toFixed(2);

		std_dev = std_dev.toFixed(2);


		median = Math.round(
				(lat_filtered[Math.floor(n/2)] + lat_filtered[Math.ceil(n/2)]) / 2
			);

		return { mean: amean, median: median, stddev: std_dev, stderr: std_err };
	},

	calc_bw: function()
	{
		var	i, j, n=0,
			r, bandwidths=[], bandwidths_corrected=[],
			sum=0, sumsq=0, sum_corrected=0, sumsq_corrected=0,
			amean, std_dev, std_err, median,
			amean_corrected, std_dev_corrected, std_err_corrected, median_corrected,
			nimgs, bw, bw_c, debug_info=[];

		for(i=0; i<this.nruns; i++) {
			if(!this.results[i] || !this.results[i].r) {
				continue;
			}

			r=this.results[i].r;

			// the next loop we iterate through backwards and only consider the largest
			// 3 images that succeeded that way we don't consider small images that
			// downloaded fast without really saturating the network
			nimgs=0;
			for(j=r.length-1; j>=0 && nimgs<3; j--) {
				// if we hit an undefined image time, we skipped everything before this
				if(!r[j]) {
					break;
				}
				if(r[j].t === null) {
					continue;
				}

				n++;
				nimgs++;

				// multiply by 1000 since t is in milliseconds and not seconds
				bw = images[j].size*1000/r[j].t;
				bandwidths.push(bw);

				if(r[j].t > this.latency.mean) {
					bw_c = images[j].size*1000/(r[j].t - this.latency.mean);
					bandwidths_corrected.push(bw_c);
				}
				else {
					debug_info.push(j + "_" + r[j].t);
				}
			}
		}

		BOOMR.debug("got " + n + " readings", "bw");

		BOOMR.debug("bandwidths: " + bandwidths, "bw");
		BOOMR.debug("corrected: " + bandwidths_corrected, "bw");

		// First do IQR filtering since we use the median here
		// and should use the stddev after filtering.
		if(bandwidths.length > 3) {
			bandwidths = this.iqr(bandwidths.sort(this.ncmp));
			bandwidths_corrected = this.iqr(bandwidths_corrected.sort(this.ncmp));
		} else {
			bandwidths = bandwidths.sort(this.ncmp);
			bandwidths_corrected = bandwidths_corrected.sort(this.ncmp);
		}

		BOOMR.debug("after iqr: " + bandwidths, "bw");
		BOOMR.debug("corrected: " + bandwidths_corrected, "bw");

		// Now get the mean & median.
		// Also get corrected values that eliminate latency
		n = Math.max(bandwidths.length, bandwidths_corrected.length);
		for(i=0; i<n; i++) {
			if(i<bandwidths.length) {
				sum += bandwidths[i];
				sumsq += Math.pow(bandwidths[i], 2);
			}
			if(i<bandwidths_corrected.length) {
				sum_corrected += bandwidths_corrected[i];
				sumsq_corrected += Math.pow(bandwidths_corrected[i], 2);
			}
		}

		n = bandwidths.length;
		amean = Math.round(sum/n);
		std_dev = Math.sqrt(sumsq/n - Math.pow(sum/n, 2));
		std_err = Math.round(1.96 * std_dev/Math.sqrt(n));
		std_dev = Math.round(std_dev);

		n = bandwidths.length-1;
		median = Math.round(
				(bandwidths[Math.floor(n/2)] + bandwidths[Math.ceil(n/2)]) / 2
			);

		if (bandwidths_corrected.length < 1) {
			BOOMR.debug("not enough valid corrected datapoints, falling back to uncorrected", "bw");
			debug_info.push("l==" + bandwidths_corrected.length);

			amean_corrected = amean;
			std_dev_corrected = std_dev;
			std_err_corrected = std_err;
			median_corrected = median;
		}
		else {
			n = bandwidths_corrected.length;
			amean_corrected = Math.round(sum_corrected/n);
			std_dev_corrected = Math.sqrt(sumsq_corrected/n - Math.pow(sum_corrected/n, 2));
			std_err_corrected = (1.96 * std_dev_corrected/Math.sqrt(n)).toFixed(2);
			std_dev_corrected = std_dev_corrected.toFixed(2);

			n = bandwidths_corrected.length-1;
			median_corrected = Math.round(
						(
							bandwidths_corrected[Math.floor(n/2)]
							+ bandwidths_corrected[Math.ceil(n/2)]
						) / 2
					);
		}

		BOOMR.debug("amean: " + amean + ", median: " + median, "bw");
		BOOMR.debug("corrected amean: " + amean_corrected + ", " + "median: " + median_corrected, "bw");

		return {
			mean: amean,
			stddev: std_dev,
			stderr: std_err,
			median: median,
			mean_corrected: amean_corrected,
			stddev_corrected: std_dev_corrected,
			stderr_corrected: std_err_corrected,
			median_corrected: median_corrected,
			debug_info: debug_info
		};
	},

	load_img: function(i, run, callback)
	{
		var url = this.base_url + images[i].name
			+ "?t=" + BOOMR.now() + Math.random(),	// Math.random() is slow, but we get it before we start the timer
		    timer=0, tstart=0,
		    img = new Image(),
		    that=this;

		function handler(value) {
			return function() {
				if(callback) {
					callback.call(that, i, tstart, run, value);
				}

				if (value !== null) {
					img.onload=img.onerror=null;
					img=null;
					clearTimeout(timer);
					that=callback=null;
				}
			};
		}

		img.onload = handler(true);
		img.onerror = handler(false);

		// the timeout does not abort download of the current image, it just sets an
		// end of loop flag so we don't attempt download of the next image we still
		// need to wait until onload or onerror fire to be sure that the image
		// download isn't using up bandwidth.  This also saves us if the timeout
		// happens on the first image.  If it didn't, we'd have nothing to measure.
		timer=setTimeout(handler(null), images[i].timeout + Math.min(400, this.latency ? this.latency.mean : 400));

		tstart = BOOMR.now();
		img.src=url;
	},

	lat_loaded: function(i, tstart, run, success)
	{
		if(run !== this.latency_runs+1) {
			return;
		}

		if(success !== null) {
			var lat = BOOMR.now() - tstart;
			this.latencies.push(lat);
		}
		// we've got all the latency images at this point,
		// so we can calculate latency
		if(this.latency_runs === 0) {
			this.latency = this.calc_latency();
		}

		BOOMR.setImmediate(this.iterate, null, null, this);
	},

	img_loaded: function(i, tstart, run, success)
	{
		if(run !== this.runs_left+1) {
			return;
		}

		if(this.results[this.nruns-run].r[i])	{	// already called on this image
			return;
		}

		// if timeout, then we set the next image to the end of loop marker
		if(success === null) {
			this.results[this.nruns-run].r[i+1] = {t:null, state: null, run: run};
			return;
		}

		var result = {
				start: tstart,
				end: BOOMR.now(),
				t: null,
				state: success,
				run: run
			};
		if(success) {
			result.t = result.end-result.start;
		}
		this.results[this.nruns-run].r[i] = result;

		// we terminate if an image timed out because that means the connection is
		// too slow to go to the next image
		if(i >= images.end-1 || this.results[this.nruns-run].r[i+1] !== undefined) {
			BOOMR.debug(BOOMR.utils.objectToString(this.results[this.nruns-run], undefined, 2), "bw");
			// First run is a pilot test to decide what the largest image
			// that we can download is. All following runs only try to
			// download this image
			if(run === this.nruns) {
				images.start = i;
			}
			BOOMR.setImmediate(this.iterate, null, null, this);
		} else {
			this.load_img(i+1, run, this.img_loaded);
		}
	},

	finish: function()
	{
		if(!this.latency) {
			this.latency = this.calc_latency();
		}
		var	bw = this.calc_bw(),
			o = {
				bw:		bw.median_corrected,
				bw_err:		parseFloat(bw.stderr_corrected, 10),
				lat:		this.latency.mean,
				lat_err:	parseFloat(this.latency.stderr, 10),
				bw_time:	Math.round(BOOMR.now()/1000)
			};

		BOOMR.addVar(o);
		if(bw.debug_info.length > 0) {
			BOOMR.addVar("bw_debug", bw.debug_info.join(","));
		}

		// If we have an IP address we can make the BA cookie persistent for a while
		// because we'll recalculate it if necessary (when the user's IP changes).
		if(!isNaN(o.bw) && o.bw > 0) {
			BOOMR.utils.setCookie(this.cookie,
						{
							ba: Math.round(o.bw),
							be: o.bw_err,
							l:  o.lat,
							le: o.lat_err,
							ip: this.user_ip,
							t:  o.bw_time
						},
						(this.user_ip ? this.cookie_exp : 0)
				);
		}

		this.complete = true;
		BOOMR.sendBeacon();
		this.running = false;
	},

	iterate: function()
	{
		if(!this.aborted) {
			if(!this.runs_left) {
				this.finish();
			}
			else if(this.latency_runs) {
				this.load_img("l", this.latency_runs--, this.lat_loaded);
			}
			else {
				this.results.push({r:[]});
				this.load_img(images.start, this.runs_left--, this.img_loaded);
			}
		}
	},

	setVarsFromCookie: function() {
		var cookies, ba, bw_e, lat, lat_e, c_sn, t, p_sn, t_now;

		cookies = BOOMR.utils.getSubCookies(BOOMR.utils.getCookie(impl.cookie));

		if (cookies && cookies.ba) {

			ba = parseInt(cookies.ba, 10);
			bw_e = parseFloat(cookies.be, 10);
			lat = parseInt(cookies.l, 10) || 0;
			lat_e = parseFloat(cookies.le, 10) || 0;
			c_sn = cookies.ip.replace(/\.\d+$/, "0");	// Note this is IPv4 only
			t = parseInt(cookies.t, 10);
			p_sn = this.user_ip.replace(/\.\d+$/, "0");

			// We use the subnet instead of the IP address because some people
			// on DHCP with the same ISP may get different IPs on the same subnet
			// every time they log in

			t_now = Math.round(BOOMR.now()/1000);	// seconds

			// If the subnet changes or the cookie is more than 7 days old,
			// then we recheck the bandwidth, else we just use what's in the cookie
			if(c_sn === p_sn && t >= t_now - this.cookie_exp && ba > 0) {
				this.complete = true;
				BOOMR.addVar({
					bw:      ba,
					lat:     lat,
					bw_err:  bw_e,
					lat_err: lat_e,
					bw_time: t
				});

				return true;
			}
		}

		return false;
	}

};

BOOMR.plugins.BW = {
	init: function(config) {
		if(impl.initialized) {
			return this;
		}

		BOOMR.utils.pluginConfig(impl, config, "BW",
						["base_url", "timeout", "nruns", "cookie", "cookie_exp", "test_https"]);

		if(config && config.user_ip) {
			impl.user_ip = config.user_ip;
		}

		if(!impl.base_url) {
			return this;
		}

		images.start = 0;
		impl.runs_left = impl.nruns;
		impl.latency_runs = 10;
		impl.results = [];
		impl.latencies = [];
		impl.latency = null;
		impl.complete = impl.aborted = false;

		BOOMR.removeVar("ba", "ba_err", "lat", "lat_err");

		if(!impl.setVarsFromCookie()) {
			BOOMR.subscribe("page_ready", this.run, null, this);
		}

		impl.initialized = true;

		return this;
	},

	run: function() {
		var a;
		if(impl.running || impl.complete) {
			return this;
		}

		// Turn image url into an absolute url if it isn't already
		a = document.createElement("a");
		a.href = impl.base_url;

		if( !impl.test_https && a.protocol === "https:") {
			// we don't run the test for https because SSL stuff will mess up b/w
			// calculations we could run the test itself over HTTP, but then IE
			// will complain about insecure resources, so the best is to just bail
			// and hope that the user gets the cookie from some other page

			BOOMR.info("HTTPS detected, skipping bandwidth test", "bw");
			impl.complete = true;
			//BOOMR.sendBeacon();
			return this;
		}

		impl.base_url = a.href;
		impl.running = true;

		setTimeout(this.abort, impl.timeout);

		impl.iterate();

		return this;
	},

	abort: function() {
		impl.aborted = true;
		if (impl.running) {
			impl.finish();	// we don't defer this call because it might be called from
					// onunload and we want the entire chain to complete
					// before we return
		}
	},

	is_complete: function() { return impl.complete; }
};

}());
// End of BW plugin


/*
 * Copyright (c), Buddy Brewer.
 */

/**
\file navtiming.js
Plugin to collect metrics from the W3C Navigation Timing API. For more information about Navigation Timing,
see: http://www.w3.org/TR/navigation-timing/
*/

(function() {

// First make sure BOOMR is actually defined.  It's possible that your plugin is loaded before boomerang, in which case
// you'll need this.
BOOMR = BOOMR || {};
BOOMR.plugins = BOOMR.plugins || {};
if (BOOMR.plugins.NavigationTiming) {
	return;
}

// A private object to encapsulate all your implementation details
var impl = {
	complete: false,
	xhr_done: function(edata) {
		var w = BOOMR.window, res, data = {}, k;

		if (!edata) {
			return;
		}

		if (edata.data) {
			edata = edata.data;
		}

		if (edata.url && w.performance && w.performance.getEntriesByName) {
			res = w.performance.getEntriesByName(edata.url);
			if(res && res.length > 0) {
				res = res[0];

				data = {
					nt_red_st: res.redirectStart,
					nt_red_end: res.redirectEnd,
					nt_fet_st: res.fetchStart,
					nt_dns_st: res.domainLookupStart,
					nt_dns_end: res.domainLookupEnd,
					nt_con_st: res.connectStart,
					nt_con_end: res.connectEnd,
					nt_req_st: res.requestStart,
					nt_res_st: res.responseStart,
					nt_res_end: res.responseEnd
				};
				if (res.secureConnectionStart) {
					// secureConnectionStart is OPTIONAL in the spec
					data.nt_ssl_st = res.secureConnectionStart;
				}

				for(k in data) {
					if (data.hasOwnProperty(k) && data[k]) {
						data[k] += w.performance.timing.navigationStart;
					}
				}

			}
		}

		if (edata.timing) {
			res = edata.timing;
			if (!data.nt_req_st) {
				data.nt_req_st = res.requestStart;
			}
			if (!data.nt_res_st) {
				data.nt_res_st = res.responseStart;
			}
			if (!data.nt_res_end) {
				data.nt_res_end = res.responseEnd;
			}
			data.nt_domint = res.domInteractive;
			data.nt_domcomp = res.domComplete;
			data.nt_load_st = res.loadEventEnd;
			data.nt_load_end = res.loadEventEnd;
		}

		for(k in data) {
			if (data.hasOwnProperty(k) && !data[k]) {
				delete data[k];
			}
		}

		BOOMR.addVar(data);

		try { impl.addedVars.push.apply(impl.addedVars, Object.keys(data)); } catch(ignore) {}

		this.complete = true;
		BOOMR.sendBeacon();
	},

	done: function() {
		var w = BOOMR.window, p, pn, pt, data;
		if(this.complete) {
			return this;
		}

		impl.addedVars = [];

		p = w.performance || w.msPerformance || w.webkitPerformance || w.mozPerformance;
		if(p && p.timing && p.navigation) {
			BOOMR.info("This user agent supports NavigationTiming.", "nt");
			pn = p.navigation;
			pt = p.timing;
			data = {
				nt_red_cnt: pn.redirectCount,
				nt_nav_type: pn.type,
				nt_nav_st: pt.navigationStart,
				nt_red_st: pt.redirectStart,
				nt_red_end: pt.redirectEnd,
				nt_fet_st: pt.fetchStart,
				nt_dns_st: pt.domainLookupStart,
				nt_dns_end: pt.domainLookupEnd,
				nt_con_st: pt.connectStart,
				nt_con_end: pt.connectEnd,
				nt_req_st: pt.requestStart,
				nt_res_st: pt.responseStart,
				nt_res_end: pt.responseEnd,
				nt_domloading: pt.domLoading,
				nt_domint: pt.domInteractive,
				nt_domcontloaded_st: pt.domContentLoadedEventStart,
				nt_domcontloaded_end: pt.domContentLoadedEventEnd,
				nt_domcomp: pt.domComplete,
				nt_load_st: pt.loadEventStart,
				nt_load_end: pt.loadEventEnd,
				nt_unload_st: pt.unloadEventStart,
				nt_unload_end: pt.unloadEventEnd
			};
			if (pt.secureConnectionStart) {
				// secureConnectionStart is OPTIONAL in the spec
				data.nt_ssl_st = pt.secureConnectionStart;
			}
			if (pt.msFirstPaint) {
				// msFirstPaint is IE9+ http://msdn.microsoft.com/en-us/library/ff974719
				data.nt_first_paint = pt.msFirstPaint;
			}

			BOOMR.addVar(data);

			try { impl.addedVars.push.apply(impl.addedVars, Object.keys(data)); } catch(ignore) {}
		}

		// XXX Inconsistency warning.  msFirstPaint above is in milliseconds while
		//     firstPaintTime below is in seconds.microseconds.  The server needs to deal with this.

		// This is Chrome only, so will not overwrite nt_first_paint above
		if(w.chrome && w.chrome.loadTimes) {
			pt = w.chrome.loadTimes();
			if(pt) {
				data = {
					nt_spdy: (pt.wasFetchedViaSpdy?1:0),
					nt_first_paint: pt.firstPaintTime
				};

				BOOMR.addVar(data);

				try { impl.addedVars.push.apply(impl.addedVars, Object.keys(data)); } catch(ignore) {}
			}
		}

		this.complete = true;
		BOOMR.sendBeacon();
	},

	clear: function(vars) {
		if (impl.addedVars && impl.addedVars.length > 0) {
			BOOMR.removeVar(impl.addedVars);
			impl.addedVars = [];
		}
		this.complete = false;
	}
};

BOOMR.plugins.NavigationTiming = {
	init: function() {
		if (!impl.initialized) {
			// we'll fire on whichever happens first
			BOOMR.subscribe("page_ready", impl.done, null, impl);
			BOOMR.subscribe("xhr_load", impl.xhr_done, null, impl);
			BOOMR.subscribe("page_unload", impl.done, null, impl);
			BOOMR.subscribe("onbeacon", impl.clear, null, impl);

			impl.initialized = true;
		}
		return this;
	},

	is_complete: function() {
		return impl.complete;
	}
};

}());

/*
 * Copyright (c) 2011, Yahoo! Inc.  All rights reserved.
 * Copyright (c) 2012, Log-Normal, Inc.  All rights reserved.
 * Copyrights licensed under the BSD License. See the accompanying LICENSE.txt file for terms.
 */

// This is the Round Trip Time plugin.  Abbreviated to RT
// the parameter is the window
(function(w) {

/*eslint no-underscore-dangle:0*/

var d=w.document, impl;

BOOMR = BOOMR || {};
BOOMR.plugins = BOOMR.plugins || {};
if (BOOMR.plugins.RT) {
	return;
}

// private object
impl = {
	onloadfired: false,	//! Set when the page_ready event fires
				//  Use this to determine if unload fires before onload
	unloadfired: false,	//! Set when the first unload event fires
				//  Use this to make sure we don't beacon twice for beforeunload and unload
	visiblefired: false,	//! Set when page becomes visible (Chrome/IE)
				//  Use this to determine if user bailed without opening the tab
	initialized: false,	//! Set when init has completed to prevent double initialization
	complete: false,	//! Set when this plugin has completed

	timers: {},		//! Custom timers that the developer can use
				// Format for each timer is { start: XXX, end: YYY, delta: YYY-XXX }
	cookie: "RT",		//! Name of the cookie that stores the start time and referrer
	cookie_exp:600,		//! Cookie expiry in seconds
	strict_referrer: true,	//! By default, don't beacon if referrers don't match.
				// If set to false, beacon both referrer values and let
				// the back end decide

	navigationType: 0,	// Navigation Type from the NavTiming API.  We mainly care if this was BACK_FORWARD
				// since cookie time will be incorrect in that case
	navigationStart: undefined,
	responseStart: undefined,
	t_start: undefined,	// t_start that came off the cookie
	cached_t_start: undefined,	// cached value of t_start once we know its real value
	t_fb_approx: undefined,	// approximate first byte time for browsers that don't support navtiming
	r: undefined,		// referrer from the cookie
	r2: undefined,		// referrer from document.referer

	// These timers are added directly as beacon variables
	basic_timers: { t_done: 1, t_resp: 1, t_page: 1},

	// Vars that were added to the beacon that we can remove after beaconing
	addedVars: [],

	/**
	 * Merge new cookie `params` onto current cookie, and set `timer` param on cookie to current timestamp
	 * @param params object containing keys & values to merge onto current cookie.  A value of `undefined`
	 *		 will remove the key from the cookie
	 * @param timer  string key name that will be set to the current timestamp on the cookie
	 *
	 * @returns true if the cookie was updated, false if the cookie could not be set for any reason
	 */
	updateCookie: function(params, timer) {
		var t_end, t_start, subcookies, k;

		// Disable use of RT cookie by setting its name to a falsy value
		if(!this.cookie) {
			return false;
		}

		subcookies = BOOMR.utils.getSubCookies(BOOMR.utils.getCookie(this.cookie)) || {};

		if (typeof params === "object") {
			for(k in params) {
				if(params.hasOwnProperty(k)) {
					if (params[k] === undefined ) {
						if (subcookies.hasOwnProperty(k)) {
							delete subcookies[k];
						}
					}
					else {
						if (k==="nu" || k==="r") {
							params[k] = BOOMR.utils.hashQueryString(params[k], true);
						}

						subcookies[k] = params[k];
					}
				}
			}
		}

		t_start = BOOMR.now();

		if(timer) {
			subcookies[timer] = t_start;
		}

		BOOMR.debug("Setting cookie (timer=" + timer + ")\n" + BOOMR.utils.objectToString(subcookies), "rt");
		if(!BOOMR.utils.setCookie(this.cookie, subcookies, this.cookie_exp)) {
			BOOMR.error("cannot set start cookie", "rt");
			return false;
		}

		t_end = BOOMR.now();
		if(t_end - t_start > 50) {
			// It took > 50ms to set the cookie
			// The user Most likely has cookie prompting turned on so
			// t_start won't be the actual unload time
			// We bail at this point since we can't reliably tell t_done
			BOOMR.utils.removeCookie(this.cookie);

			// at some point we may want to log this info on the server side
			BOOMR.error("took more than 50ms to set cookie... aborting: "
					+ t_start + " -> " + t_end, "rt");
		}

		return true;
	},

	/**
	 * Read initial values from cookie and clear out cookie values it cares about after reading.
	 * This makes sure that other pages (eg: loaded in new tabs) do not get an invalid cookie time.
	 * This method should only be called from init, and may be called more than once.
	 *
	 * Request start time is the greater of last page beforeunload or last click time
	 * If start time came from a click, we check that the clicked URL matches the current URL
	 * If it came from a beforeunload, we check that cookie referrer matches document.referrer
	 *
	 * If we had a pageHide time or unload time, we use that as a proxy for first byte on non-navtiming
	 * browsers.
	 */
	initFromCookie: function() {
		var url, subcookies;
		subcookies = BOOMR.utils.getSubCookies(BOOMR.utils.getCookie(this.cookie));

		if(!subcookies) {
			return;
		}

		subcookies.s = Math.max(+subcookies.ul||0, +subcookies.cl||0);

		BOOMR.debug("Read from cookie " + BOOMR.utils.objectToString(subcookies), "rt");

		// If we have a start time, and either a referrer, or a clicked on URL,
		// we check if the start time is usable
		if(subcookies.s && (subcookies.r || subcookies.nu)) {
			this.r = subcookies.r;
			url = BOOMR.utils.hashQueryString(d.URL, true);

			// Either the URL of the page setting the cookie needs to match document.referrer
			BOOMR.debug(this.r + " =?= " + this.r2, "rt");

			// Or the start timer was no more than 15ms after a click or form submit
			// and the URL clicked or submitted to matches the current page's URL
			// (note the start timer may be later than click if both click and beforeunload fired
			// on the previous page)
			BOOMR.debug(subcookies.s + " <? " + (+subcookies.cl+15), "rt");
			BOOMR.debug(subcookies.nu + " =?= " + url, "rt");

			if (!this.strict_referrer ||
				(subcookies.nu && subcookies.nu === url && subcookies.s < +subcookies.cl + 15) ||
				(subcookies.s === +subcookies.ul && this.r === this.r2)
			) {
				this.t_start = subcookies.s;

				// additionally, if we have a pagehide, or unload event, that's a proxy
				// for the first byte of the current page, so use that wisely
				if(+subcookies.hd > subcookies.s) {
					this.t_fb_approx = parseInt(subcookies.hd, 10);
				}
			}
			else {
				this.t_start = this.t_fb_approx = undefined;
			}
		}

		// Now that we've pulled out the timers, we'll clear them so they don't pollute future calls
		this.updateCookie({
			s: undefined,	// start timer
			r: undefined,	// referrer
			nu: undefined,	// clicked url
			ul: undefined,	// onbeforeunload time
			cl: undefined,	// onclick time
			hd: undefined	// onunload or onpagehide time
		});
	},

	/**
	 * Figure out how long boomerang and config.js took to load using resource timing if available, or built in timestamps
	 */
	getBoomerangTimings: function() {
		var res, k, urls, url, startTime, data;

		function trimTiming(time, startTime) {
			// strip from microseconds to milliseconds only
			var timeMs = Math.round(time ? time : 0),
			    startTimeMs = Math.round(startTime ? startTime : 0);

			timeMs = (timeMs === 0 ? 0 : (timeMs - startTimeMs));

			return timeMs ? timeMs : "";
		}

		if(BOOMR.t_start) {
			// How long does it take Boomerang to load up and execute (fb to lb)?
			BOOMR.plugins.RT.startTimer("boomerang", BOOMR.t_start);
			BOOMR.plugins.RT.endTimer("boomerang", BOOMR.t_end);	// t_end === null defaults to current time

			// How long did it take from page request to boomerang fb?
			BOOMR.plugins.RT.endTimer("boomr_fb", BOOMR.t_start);

			if(BOOMR.t_lstart) {
				// when did the boomerang loader start loading boomerang on the page?
				BOOMR.plugins.RT.endTimer("boomr_ld", BOOMR.t_lstart);
				// What was the network latency for boomerang (request to first byte)?
				BOOMR.plugins.RT.setTimer("boomr_lat", BOOMR.t_start - BOOMR.t_lstart);
			}
		}

		// use window and not w because we want the inner iframe
		try
		{
			if (window.performance && window.performance.getEntriesByName) {
				urls = { "rt.bmr" : BOOMR.url };

				for(url in urls) {
					if(urls.hasOwnProperty(url) && urls[url]) {
						res = window.performance.getEntriesByName(urls[url]);
						if(!res || res.length === 0) {
							continue;
						}
						res = res[0];

						startTime = trimTiming(res.startTime, 0);
						data = [
							startTime,
							trimTiming(res.responseEnd, startTime),
							trimTiming(res.responseStart, startTime),
							trimTiming(res.requestStart, startTime),
							trimTiming(res.connectEnd, startTime),
							trimTiming(res.secureConnectionStart, startTime),
							trimTiming(res.connectStart, startTime),
							trimTiming(res.domainLookupEnd, startTime),
							trimTiming(res.domainLookupStart, startTime),
							trimTiming(res.redirectEnd, startTime),
							trimTiming(res.redirectStart, startTime)
						].join(",").replace(/,+$/, "");

						BOOMR.addVar(url, data);
						impl.addedVars.push(url);
					}
				}
			}
		}
		catch(e)
		{
			BOOMR.addError(e, "rt.getBoomerangTimings");
		}
	},

	/**
	 * Check if we're in a prerender state, and if we are, set additional timers.
	 * In Chrome/IE, a prerender state is when a page is completely rendered in an in-memory buffer, before
	 * a user requests that page.  We do not beacon at this point because the user has not shown intent
	 * to view the page.  If the user opens the page, the visibility state changes to visible, and we
	 * fire the beacon at that point, including any timing details for prerendering.
	 *
	 * Sets the `t_load` timer to the actual value of page load time (request initiated by browser to onload)
	 *
	 * @returns true if this is a prerender state, false if not (or not supported)
	 */
	checkPreRender: function() {
		if(BOOMR.visibilityState() !== "prerender") {
			return false;
		}

		// This means that onload fired through a pre-render.  We'll capture this
		// time, but wait for t_done until after the page has become either visible
		// or hidden (ie, it moved out of the pre-render state)
		// http://code.google.com/chrome/whitepapers/pagevisibility.html
		// http://www.w3.org/TR/2011/WD-page-visibility-20110602/
		// http://code.google.com/chrome/whitepapers/prerender.html

		BOOMR.plugins.RT.startTimer("t_load", this.navigationStart);
		BOOMR.plugins.RT.endTimer("t_load");					// this will measure actual onload time for a prerendered page
		BOOMR.plugins.RT.startTimer("t_prerender", this.navigationStart);
		BOOMR.plugins.RT.startTimer("t_postrender");				// time from prerender to visible or hidden

		return true;
	},

	/**
	 * Initialise timers from the NavigationTiming API.  This method looks at various sources for
	 * Navigation Timing, and also patches around bugs in various browser implementations.
	 * It sets the beacon parameter `rt.start` to the source of the timer
	 */
	initFromNavTiming: function() {
		var ti, p, source;

		if(this.navigationStart) {
			return;
		}

		// Get start time from WebTiming API see:
		// https://dvcs.w3.org/hg/webperf/raw-file/tip/specs/NavigationTiming/Overview.html
		// http://blogs.msdn.com/b/ie/archive/2010/06/28/measuring-web-page-performance.aspx
		// http://blog.chromium.org/2010/07/do-you-know-how-slow-your-web-page-is.html
		p = w.performance || w.msPerformance || w.webkitPerformance || w.mozPerformance;

		if(p && p.navigation) {
			this.navigationType = p.navigation.type;
		}

		if(p && p.timing) {
			ti = p.timing;
		}
		else if(w.chrome && w.chrome.csi && w.chrome.csi().startE) {
			// Older versions of chrome also have a timing API that's sort of documented here:
			// http://ecmanaut.blogspot.com/2010/06/google-bom-feature-ms-since-pageload.html
			// source here:
			// http://src.chromium.org/viewvc/chrome/trunk/src/chrome/renderer/loadtimes_extension_bindings.cc?view=markup
			ti = {
				navigationStart: w.chrome.csi().startE
			};
			source = "csi";
		}
		else if(w.gtbExternal && w.gtbExternal.startE()) {
			// The Google Toolbar exposes navigation start time similar to old versions of chrome
			// This would work for any browser that has the google toolbar installed
			ti = {
				navigationStart: w.gtbExternal.startE()
			};
			source = "gtb";
		}

		if(ti) {
			// Always use navigationStart since it falls back to fetchStart (not with redirects)
			// If not set, we leave t_start alone so that timers that depend
			// on it don't get sent back.  Never use requestStart since if
			// the first request fails and the browser retries, it will contain
			// the value for the new request.
			BOOMR.addVar("rt.start", source || "navigation");
			this.navigationStart = ti.navigationStart || ti.fetchStart || undefined;
			this.responseStart = ti.responseStart || undefined;

			// bug in Firefox 7 & 8 https://bugzilla.mozilla.org/show_bug.cgi?id=691547
			if(navigator.userAgent.match(/Firefox\/[78]\./)) {
				this.navigationStart = ti.unloadEventStart || ti.fetchStart || undefined;
			}
		}
		else {
			BOOMR.warn("This browser doesn't support the WebTiming API", "rt");
		}

		return;
	},

	/**
	 * Validate that the time we think is the load time is correct.  This can be wrong if boomerang was loaded
	 * after onload, so in that case, if navigation timing is available, we use that instead.
	 */
	validateLoadTimestamp: function(t_now, data) {
		var t_done = t_now;

		// xhr beacon with detailed timing information
		if (data && data.timing && data.timing.loadEventEnd) {
			t_done = data.timing.loadEventEnd;
		}
		// Boomerang loaded late and...
		else if (BOOMR.loadedLate) {
			// We have navigation timing,
			if(w.performance && w.performance.timing) {
				// and boomerang loaded after onload fired
				if(w.performance.timing.loadEventStart && w.performance.timing.loadEventStart < BOOMR.t_end) {
					t_done = w.performance.timing.loadEventStart;
				}
			}
			// We don't have navigation timing,
			else {
				// So we'll just use the time when boomerang was added to the page
				// Assuming that this means boomerang was added in onload
				t_done = BOOMR.t_lstart || BOOMR.t_start || t_now;
			}
		}

		return t_done;
	},

	/**
	 * Set timers appropriate at page load time.  This method should be called from done() only when
	 * the page_ready event fires.  It sets the following timer values:
	 *		- t_resp:	time from request start to first byte
	 *		- t_page:	time from first byte to load
	 *		- t_postrender	time from prerender state to visible state
	 *		- t_prerender	time from navigation start to visible state
	 *
	 * @param ename  The Event name that initiated this control flow
	 * @param t_done The timestamp when the done() method was called
	 * @param data   Event data passed in from the caller.  For xhr beacons, this may contain detailed timing information
	 *
	 * @returns true if timers were set, false if we're in a prerender state, caller should abort on false.
	 */
	setPageLoadTimers: function(ename, t_done, data) {
		var t_resp_start;

		if(ename !== "xhr") {
			impl.initFromCookie();
			impl.initFromNavTiming();

			if(impl.checkPreRender()) {
				return false;
			}
		}

		if(ename === "xhr") {
			if(data && data.timing) {
				// Use details from xhr object to figure out resp latency and page time
				// t_resp will use the cookie if available or fallback to NavTiming
				t_resp_start = data.timing.responseStart;
			}
		}
		else if(impl.responseStart) {
			// Use NavTiming API to figure out resp latency and page time
			// t_resp will use the cookie if available or fallback to NavTiming
			t_resp_start = impl.responseStart;
		}
		else if(impl.timers.hasOwnProperty("t_page")) {
			// If the dev has already started t_page timer, we can end it now as well
			BOOMR.plugins.RT.endTimer("t_page");
		}
		else if(impl.t_fb_approx) {
			// If we have an approximate first byte time from the cookie, use it
			t_resp_start = impl.t_fb_approx;
		}

		if (t_resp_start) {
			BOOMR.plugins.RT.endTimer("t_resp", t_resp_start);

			if(impl.timers.t_load) {	// t_load is the actual time load completed if using prerender
				BOOMR.plugins.RT.setTimer("t_page", impl.timers.t_load.end - t_resp_start);
			}
			else {
				BOOMR.plugins.RT.setTimer("t_page", t_done - t_resp_start);
			}
		}

		// If a prerender timer was started, we can end it now as well
		if(impl.timers.hasOwnProperty("t_postrender")) {
			BOOMR.plugins.RT.endTimer("t_postrender");
			BOOMR.plugins.RT.endTimer("t_prerender");
		}

		return true;
	},

	/**
	 * Writes a bunch of timestamps onto the beacon that help in request tracing on the server
	 * 	- rt.tstart: The value of t_start that we determined was appropriate
	 *	- rt.cstart: The value of t_start from the cookie if different from rt.tstart
	 *	- rt.bstart: The timestamp when boomerang started
	 *	- rt.end:    The timestamp when the t_done timer ended
	 *
	 * @param t_start The value of t_start that we plan to use
	 */
	setSupportingTimestamps: function(t_start) {
		if (t_start) {
			BOOMR.addVar("rt.tstart", t_start);
		}
		if(typeof impl.t_start === "number" && impl.t_start !== t_start) {
			BOOMR.addVar("rt.cstart", impl.t_start);
		}
		BOOMR.addVar("rt.bstart", BOOMR.t_start);
		if (BOOMR.t_lstart) {
			BOOMR.addVar("rt.blstart", BOOMR.t_lstart);
		}
		BOOMR.addVar("rt.end", impl.timers.t_done.end);	// don't just use t_done because dev may have called endTimer before we did
	},

	/**
	 * Determines the best value to use for t_start.
	 * If called from an xhr call, then use the start time for that call
	 * Else, If we have navigation timing, use that
	 * Else, If we have a cookie time, and this isn't the result of a BACK button, use the cookie time
	 * Else, if we have a cached timestamp from an earlier call, use that
	 * Else, give up
	 *
	 * @param ename	The event name that resulted in this call. Special consideration for "xhr"
	 * @param data  Data passed in from the event caller. If the event name is "xhr",
	 *              this should contain the page group name for the xhr call in an attribute called `name`
	 *		and optionally, detailed timing information in a sub-object called `timing`
	 *              and resource information in a sub-object called `resource`
	 *
	 * @returns the determined value of t_start or undefined if unknown
	 */
	determineTStart: function(ename, data) {
		var t_start;
		if(ename==="xhr") {
			if(data && data.name && impl.timers[data.name]) {
				// For xhr timers, t_start is stored in impl.timers.xhr_{page group name}
				// and xhr.pg is set to {page group name}
				t_start = impl.timers[data.name].start;
			}
			else if(data && data.timing && data.timing.requestStart) {
				// For automatically instrumented xhr timers, we have detailed timing information
				t_start = data.timing.requestStart;
			}
			BOOMR.addVar("rt.start", "manual");
		}
		else if(impl.navigationStart) {
			t_start = impl.navigationStart;
		}
		else if(impl.t_start && impl.navigationType !== 2) {
			t_start = impl.t_start;			// 2 is TYPE_BACK_FORWARD but the constant may not be defined across browsers
			BOOMR.addVar("rt.start", "cookie");	// if the user hit the back button, referrer will match, and cookie will match
		}						// but will have time of previous page start, so t_done will be wrong
		else if(impl.cached_t_start) {
			t_start = impl.cached_t_start;
		}
		else {
			BOOMR.addVar("rt.start", "none");
			t_start = undefined;			// force all timers to NaN state
		}

		BOOMR.debug("Got start time: " + t_start, "rt");
		impl.cached_t_start = t_start;

		return t_start;
	},

	page_ready: function() {
		// we need onloadfired because it's possible to reset "impl.complete"
		// if you're measuring multiple xhr loads, but not possible to reset
		// impl.onloadfired
		this.onloadfired = true;
	},

	check_visibility: function() {
		// we care if the page became visible at some point
		if(BOOMR.visibilityState() === "visible") {
			impl.visiblefired = true;
		}

		if(impl.visibilityState === "prerender" && BOOMR.visibilityState() !== "prerender") {
			BOOMR.plugins.RT.done(null, "visible");
		}

		impl.visibilityState = BOOMR.visibilityState();
	},

	page_unload: function(edata) {
		BOOMR.debug("Unload called with " + BOOMR.utils.objectToString(edata) + " when unloadfired = " + this.unloadfired, "rt");
		if(!this.unloadfired) {
			// run done on abort or on page_unload to measure session length
			BOOMR.plugins.RT.done(edata, "unload");
		}

		// set cookie for next page
		// We use document.URL instead of location.href because of a bug in safari 4
		// where location.href is URL decoded
		this.updateCookie({ "r": d.URL }, edata.type === "beforeunload"?"ul":"hd");

		this.unloadfired = true;
	},

	_iterable_click: function(name, element, etarget, value_cb) {
		var value;
		if(!etarget) {
			return;
		}
		BOOMR.debug(name + " called with " + etarget.nodeName, "rt");
		while(etarget && etarget.nodeName.toUpperCase() !== element) {
			etarget = etarget.parentNode;
		}
		if(etarget && etarget.nodeName.toUpperCase() === element) {
			BOOMR.debug("passing through", "rt");
			// user event, they may be going to another page
			// if this page is being opened in a different tab, then
			// our unload handler won't fire, so we need to set our
			// cookie on click or submit
			value = value_cb(etarget);
			this.updateCookie({ "nu": value }, "cl" );
			BOOMR.addVar("nu", BOOMR.utils.cleanupURL(value));
			impl.addedVars.push("nu");
		}
	},

	onclick: function(etarget) {
		impl._iterable_click("Click", "A", etarget, function(t) { return t.href; });
	},

	onsubmit: function(etarget) {
		impl._iterable_click("Submit", "FORM", etarget, function(t) {
			var v = t.getAttribute("action") || d.URL || "";
			return v.match(/\?/) ? v : v + "?";
		});
	},

	domloaded: function() {
		BOOMR.plugins.RT.endTimer("t_domloaded");
	},

	clear: function(vars) {
		if (impl.addedVars && impl.addedVars.length > 0) {
			BOOMR.removeVar(impl.addedVars);
			impl.addedVars = [];
		}
	}
};

BOOMR.plugins.RT = {
	// Methods

	init: function(config) {
		BOOMR.debug("init RT", "rt");
		if(w !== BOOMR.window) {
			w = BOOMR.window;
		}
		d = w.document;

		BOOMR.utils.pluginConfig(impl, config, "RT",
					["cookie", "cookie_exp", "strict_referrer"]);

		// A beacon may be fired automatically on page load or if the page dev fires
		// it manually with their own timers.  It may not always contain a referrer
		// (eg: XHR calls).  We set default values for these cases.
		// This is done before reading from the cookie because the cookie overwrites
		// impl.r
		impl.r = impl.r2 = BOOMR.utils.hashQueryString(d.referrer, true);

		// Now pull out start time information from the cookie
		// We'll do this every time init is called, and every time we call it, it will
		// overwrite values already set (provided there are values to read out)
		impl.initFromCookie();

		// We'll get BoomerangTimings every time init is called because it could also
		// include additional timers which might happen on a subsequent init call.
		impl.getBoomerangTimings();

		// only initialize once.  we still collect config and check/set cookies
		// every time init is called, but we attach event handlers only once
		if(impl.initialized) {
			return this;
		}

		impl.complete = false;
		impl.timers = {};

		impl.check_visibility();

		BOOMR.subscribe("page_ready", impl.page_ready, null, impl);
		BOOMR.subscribe("visibility_changed", impl.check_visibility, null, impl);
		BOOMR.subscribe("page_ready", this.done, "load", this);
		BOOMR.subscribe("xhr_load", this.done, "xhr", this);
		BOOMR.subscribe("dom_loaded", impl.domloaded, null, impl);
		BOOMR.subscribe("page_unload", impl.page_unload, null, impl);
		BOOMR.subscribe("click", impl.onclick, null, impl);
		BOOMR.subscribe("form_submit", impl.onsubmit, null, impl);
		BOOMR.subscribe("before_beacon", this.addTimersToBeacon, "beacon", this);
		BOOMR.subscribe("onbeacon", impl.clear, null, impl);

		impl.initialized = true;
		return this;
	},

	startTimer: function(timer_name, time_value) {
		if(timer_name) {
			if (timer_name === "t_page") {
				this.endTimer("t_resp", time_value);
			}
			impl.timers[timer_name] = {start: (typeof time_value === "number" ? time_value : BOOMR.now())};
		}

		return this;
	},

	endTimer: function(timer_name, time_value) {
		if(timer_name) {
			impl.timers[timer_name] = impl.timers[timer_name] || {};
			if(impl.timers[timer_name].end === undefined) {
				impl.timers[timer_name].end =
						(typeof time_value === "number" ? time_value : BOOMR.now());
			}
		}

		return this;
	},

	setTimer: function(timer_name, time_delta) {
		if(timer_name) {
			impl.timers[timer_name] = { delta: time_delta };
		}

		return this;
	},

	addTimersToBeacon: function(vars, source) {
		var t_name, timer,
		    t_other=[];

		for(t_name in impl.timers) {
			if(impl.timers.hasOwnProperty(t_name)) {
				timer = impl.timers[t_name];

				// if delta is a number, then it was set using setTimer
				// if not, then we have to calculate it using start & end
				if(typeof timer.delta !== "number") {
					if(typeof timer.start !== "number") {
						timer.start = impl.cached_t_start;
					}
					timer.delta = timer.end - timer.start;
				}

				// If the caller did not set a start time, and if there was no start cookie
				// Or if there was no end time for this timer,
				// then timer.delta will be NaN, in which case we discard it.
				if(isNaN(timer.delta)) {
					continue;
				}

				if(impl.basic_timers.hasOwnProperty(t_name)) {
					BOOMR.addVar(t_name, timer.delta);
					impl.addedVars.push(t_name);
				}
				else {
					t_other.push(t_name + "|" + timer.delta);
				}
			}
		}

		if (t_other.length) {
			BOOMR.addVar("t_other", t_other.join(","));
			impl.addedVars.push("t_other");
		}

		if (source === "beacon") {
			impl.timers = {};
			impl.complete = false;	// reset this state for the next call
		}
	},

	// Called when the page has reached a "usable" state.  This may be when the
	// onload event fires, or it could be at some other moment during/after page
	// load when the page is usable by the user
	done: function(edata, ename) {
		// try/catch just in case edata contains cross-origin data and objectToString throws a security exception
		try {
			BOOMR.debug("Called done with " + BOOMR.utils.objectToString(edata, undefined, 1) + ", " + ename, "rt");
		}
		catch(err) {
			BOOMR.debug("Called done with " + err + ", " + ename, "rt");
		}
		var t_start, t_done, t_now=BOOMR.now(),
		    subresource = false;

		impl.complete = false;

		t_done = impl.validateLoadTimestamp(t_now, edata);

		if(ename==="load" || ename==="visible" || ename==="xhr") {
			if (!impl.setPageLoadTimers(ename, t_done, edata)) {
				return this;
			}
		}

		t_start = impl.determineTStart(ename, edata);

		if(edata && edata.data) {
			edata = edata.data;
		}

		if(ename === "xhr" && edata) {
			subresource = edata.subresource;
		}

		// If the dev has already called endTimer, then this call will do nothing
		// else, it will stop the page load timer
		this.endTimer("t_done", t_done);

		// make sure old variables don't stick around
		BOOMR.removeVar(
			"t_done", "t_page", "t_resp", "t_postrender", "t_prerender", "t_load", "t_other",
			"r", "r2", "rt.tstart", "rt.cstart", "rt.bstart", "rt.end", "rt.subres", "rt.abld",
			"http.errno", "http.method", "xhr.sync"
		);

		impl.setSupportingTimestamps(t_start);

		this.addTimersToBeacon();

		BOOMR.addVar("r", BOOMR.utils.cleanupURL(impl.r));

		if(impl.r2 !== impl.r) {
			BOOMR.addVar("r2", BOOMR.utils.cleanupURL(impl.r2));
		}

		if (ename === "xhr" && edata) {
			if(edata.url) {
				BOOMR.addVar("u", BOOMR.utils.cleanupURL(edata.url.replace(/#.*/, "")));
				impl.addedVars.push("u");
			}

			if(edata.status && (edata.status < -1 || edata.status >= 400)) {
				BOOMR.addVar("http.errno", edata.status);
			}

			if(edata.method && edata.method !== "GET") {
				BOOMR.addVar("http.method", edata.method);
			}

			if(edata.headers) {
				BOOMR.addVar("http.hdr", edata.headers);
			}

			if(edata.synchronous) {
				BOOMR.addVar("xhr.sync", 1);
			}

			if(edata.initiator) {
				BOOMR.addVar("http.initiator", edata.initiator);
			}

			impl.addedVars.push("http.errno", "http.method", "http.hdr", "xhr.sync", "http.initiator");
		}

		if(subresource) {
			BOOMR.addVar("rt.subres", 1);
			impl.addedVars.push("rt.subres");
		}
		impl.updateCookie();

		if(ename==="unload") {
			BOOMR.addVar("rt.quit", "");

			if(!impl.onloadfired) {
				BOOMR.addVar("rt.abld", "");
			}

			if(!impl.visiblefired) {
				BOOMR.addVar("rt.ntvu", "");
			}
		}

		impl.complete = true;

		BOOMR.sendBeacon();

		return this;
	},

	is_complete: function() { return impl.complete; }

};

}(window));
// End of RT plugin


BOOMR.t_end = new Date().getTime();

/*jslint continue: true, plusplus: true, regexp: true, unparam: true, sloppy: true, white: true, browser: true, devel: true */
/*properties BOOMR, BOOMR_lstart, BOOMR_start, BOOMR_configt*/

