# ZAP Scanning Report

ZAP by [Checkmarx](https://checkmarx.com/).


## Summary of Alerts

| Risk Level | Number of Alerts |
| --- | --- |
| High | 0 |
| Medium | 3 |
| Low | 4 |
| Informational | 4 |




## Insights

| Level | Reason | Site | Description | Statistic |
| --- | --- | --- | --- | --- |
| Low | Warning |  | ZAP warnings logged - see the zap.log file for details | 4    |
| Info | Informational | https://prochart-pc130-final-20260715T002005Z | Percentage of responses with status code 2xx | 100 % |
| Info | Informational | https://prochart-pc130-final-20260715T002005Z | Percentage of endpoints with content type application/xml | 50 % |
| Info | Informational | https://prochart-pc130-final-20260715T002005Z | Percentage of endpoints with content type text/plain | 50 % |
| Info | Informational | https://prochart-pc130-final-20260715T002005Z | Percentage of endpoints with method GET | 100 % |
| Info | Informational | https://prochart-pc130-final-20260715T002005Z | Count of total endpoints | 2    |
| Info | Informational | https://prochart-pc130-final-20260715t002005z | Percentage of responses with status code 2xx | 91 % |
| Info | Informational | https://prochart-pc130-final-20260715t002005z | Percentage of responses with status code 4xx | 8 % |
| Info | Informational | https://prochart-pc130-final-20260715t002005z | Percentage of endpoints with content type application/javascript | 8 % |
| Info | Informational | https://prochart-pc130-final-20260715t002005z | Percentage of endpoints with content type application/json | 8 % |
| Info | Informational | https://prochart-pc130-final-20260715t002005z | Percentage of endpoints with content type application/octet-stream | 8 % |
| Info | Informational | https://prochart-pc130-final-20260715t002005z | Percentage of endpoints with content type image/png | 8 % |
| Info | Informational | https://prochart-pc130-final-20260715t002005z | Percentage of endpoints with content type text/css | 41 % |
| Info | Informational | https://prochart-pc130-final-20260715t002005z | Percentage of endpoints with content type text/html | 25 % |
| Info | Informational | https://prochart-pc130-final-20260715t002005z | Percentage of endpoints with method GET | 100 % |
| Info | Informational | https://prochart-pc130-final-20260715t002005z | Count of total endpoints | 12    |







## Alerts

| Name | Risk Level | Number of Instances |
| --- | --- | --- |
| CSP: Wildcard Directive | Medium | 3 |
| CSP: script-src unsafe-eval | Medium | 3 |
| CSP: style-src unsafe-inline | Medium | 3 |
| Cross-Origin-Embedder-Policy Header Missing or Invalid | Low | 2 |
| Cross-Origin-Opener-Policy Header Missing or Invalid | Low | 2 |
| Cross-Origin-Resource-Policy Header Missing or Invalid | Low | Systemic |
| Server Leaks Version Information via "Server" HTTP Response Header Field | Low | Systemic |
| Modern Web Application | Informational | 4 |
| Non-Storable Content | Informational | 3 |
| Re-examine Cache-control Directives | Informational | 2 |
| Storable and Cacheable Content | Informational | Systemic |




## Alert Detail



### [ CSP: Wildcard Directive ](https://www.zaproxy.org/docs/alerts/10055/)



##### Medium (High)

### Description

Content Security Policy (CSP) is an added layer of security that helps to detect and mitigate certain types of attacks. Including (but not limited to) Cross Site Scripting (XSS), and data injection attacks. These attacks are used for everything from data theft to site defacement or distribution of malware. CSP provides a set of standard HTTP headers that allow website owners to declare approved sources of content that browsers should be allowed to load on that page — covered types are JavaScript, CSS, HTML frames, fonts, images and embeddable objects such as Java applets, ActiveX, audio and video files.

* URL: https://prochart-pc130-final-20260715T002005Z
  * Node Name: `https://prochart-pc130-final-20260715T002005Z`
  * Method: `GET`
  * Parameter: `Content-Security-Policy`
  * Attack: ``
  * Evidence: `default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'unsafe-eval' 'sha256-aF/iCowKFbkBQV8blW86a4NG08HFM7xzzyuKi3NeF9c=' https://telegram.org; script-src-attr 'none'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob: https:; media-src 'self' blob:; connect-src 'self' wss://pro-chart.ir wss://pro-chart.com; frame-src https://oauth.telegram.org; manifest-src 'self'; upgrade-insecure-requests`
  * Other Info: `The following directives either allow wildcard sources (or ancestors), are not defined, or are overly broadly defined:
img-src`
* URL: https://prochart-pc130-final-20260715t002005z/
  * Node Name: `https://prochart-pc130-final-20260715t002005z/`
  * Method: `GET`
  * Parameter: `Content-Security-Policy`
  * Attack: ``
  * Evidence: `default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'unsafe-eval' 'sha256-aF/iCowKFbkBQV8blW86a4NG08HFM7xzzyuKi3NeF9c=' https://telegram.org; script-src-attr 'none'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob: https:; media-src 'self' blob:; connect-src 'self' wss://pro-chart.ir wss://pro-chart.com; frame-src https://oauth.telegram.org; manifest-src 'self'; upgrade-insecure-requests`
  * Other Info: `The following directives either allow wildcard sources (or ancestors), are not defined, or are overly broadly defined:
img-src`
* URL: https://prochart-pc130-final-20260715t002005z/live/
  * Node Name: `https://prochart-pc130-final-20260715t002005z/live/`
  * Method: `GET`
  * Parameter: `Content-Security-Policy`
  * Attack: ``
  * Evidence: `default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'unsafe-eval' 'sha256-aF/iCowKFbkBQV8blW86a4NG08HFM7xzzyuKi3NeF9c=' https://telegram.org; script-src-attr 'none'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob: https:; media-src 'self' blob:; connect-src 'self' wss://pro-chart.ir wss://pro-chart.com; frame-src https://oauth.telegram.org; manifest-src 'self'; upgrade-insecure-requests`
  * Other Info: `The following directives either allow wildcard sources (or ancestors), are not defined, or are overly broadly defined:
img-src`


Instances: 3

### Solution

Ensure that your web server, application server, load balancer, etc. is properly configured to set the Content-Security-Policy header.

### Reference


* [ https://www.w3.org/TR/CSP/ ](https://www.w3.org/TR/CSP/)
* [ https://caniuse.com/#search=content+security+policy ](https://caniuse.com/#search=content+security+policy)
* [ https://content-security-policy.com/ ](https://content-security-policy.com/)
* [ https://github.com/HtmlUnit/htmlunit-csp ](https://github.com/HtmlUnit/htmlunit-csp)
* [ https://web.dev/articles/csp#resource-options ](https://web.dev/articles/csp#resource-options)


#### CWE Id: [ 693 ](https://cwe.mitre.org/data/definitions/693.html)


#### WASC Id: 15

#### Source ID: 3

### [ CSP: script-src unsafe-eval ](https://www.zaproxy.org/docs/alerts/10055/)



##### Medium (High)

### Description

Content Security Policy (CSP) is an added layer of security that helps to detect and mitigate certain types of attacks. Including (but not limited to) Cross Site Scripting (XSS), and data injection attacks. These attacks are used for everything from data theft to site defacement or distribution of malware. CSP provides a set of standard HTTP headers that allow website owners to declare approved sources of content that browsers should be allowed to load on that page — covered types are JavaScript, CSS, HTML frames, fonts, images and embeddable objects such as Java applets, ActiveX, audio and video files.

* URL: https://prochart-pc130-final-20260715T002005Z
  * Node Name: `https://prochart-pc130-final-20260715T002005Z`
  * Method: `GET`
  * Parameter: `Content-Security-Policy`
  * Attack: ``
  * Evidence: `default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'unsafe-eval' 'sha256-aF/iCowKFbkBQV8blW86a4NG08HFM7xzzyuKi3NeF9c=' https://telegram.org; script-src-attr 'none'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob: https:; media-src 'self' blob:; connect-src 'self' wss://pro-chart.ir wss://pro-chart.com; frame-src https://oauth.telegram.org; manifest-src 'self'; upgrade-insecure-requests`
  * Other Info: `script-src includes unsafe-eval.`
* URL: https://prochart-pc130-final-20260715t002005z/
  * Node Name: `https://prochart-pc130-final-20260715t002005z/`
  * Method: `GET`
  * Parameter: `Content-Security-Policy`
  * Attack: ``
  * Evidence: `default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'unsafe-eval' 'sha256-aF/iCowKFbkBQV8blW86a4NG08HFM7xzzyuKi3NeF9c=' https://telegram.org; script-src-attr 'none'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob: https:; media-src 'self' blob:; connect-src 'self' wss://pro-chart.ir wss://pro-chart.com; frame-src https://oauth.telegram.org; manifest-src 'self'; upgrade-insecure-requests`
  * Other Info: `script-src includes unsafe-eval.`
* URL: https://prochart-pc130-final-20260715t002005z/live/
  * Node Name: `https://prochart-pc130-final-20260715t002005z/live/`
  * Method: `GET`
  * Parameter: `Content-Security-Policy`
  * Attack: ``
  * Evidence: `default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'unsafe-eval' 'sha256-aF/iCowKFbkBQV8blW86a4NG08HFM7xzzyuKi3NeF9c=' https://telegram.org; script-src-attr 'none'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob: https:; media-src 'self' blob:; connect-src 'self' wss://pro-chart.ir wss://pro-chart.com; frame-src https://oauth.telegram.org; manifest-src 'self'; upgrade-insecure-requests`
  * Other Info: `script-src includes unsafe-eval.`


Instances: 3

### Solution

Ensure that your web server, application server, load balancer, etc. is properly configured to set the Content-Security-Policy header.

### Reference


* [ https://www.w3.org/TR/CSP/ ](https://www.w3.org/TR/CSP/)
* [ https://caniuse.com/#search=content+security+policy ](https://caniuse.com/#search=content+security+policy)
* [ https://content-security-policy.com/ ](https://content-security-policy.com/)
* [ https://github.com/HtmlUnit/htmlunit-csp ](https://github.com/HtmlUnit/htmlunit-csp)
* [ https://web.dev/articles/csp#resource-options ](https://web.dev/articles/csp#resource-options)


#### CWE Id: [ 693 ](https://cwe.mitre.org/data/definitions/693.html)


#### WASC Id: 15

#### Source ID: 3

### [ CSP: style-src unsafe-inline ](https://www.zaproxy.org/docs/alerts/10055/)



##### Medium (High)

### Description

Content Security Policy (CSP) is an added layer of security that helps to detect and mitigate certain types of attacks. Including (but not limited to) Cross Site Scripting (XSS), and data injection attacks. These attacks are used for everything from data theft to site defacement or distribution of malware. CSP provides a set of standard HTTP headers that allow website owners to declare approved sources of content that browsers should be allowed to load on that page — covered types are JavaScript, CSS, HTML frames, fonts, images and embeddable objects such as Java applets, ActiveX, audio and video files.

* URL: https://prochart-pc130-final-20260715T002005Z
  * Node Name: `https://prochart-pc130-final-20260715T002005Z`
  * Method: `GET`
  * Parameter: `Content-Security-Policy`
  * Attack: ``
  * Evidence: `default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'unsafe-eval' 'sha256-aF/iCowKFbkBQV8blW86a4NG08HFM7xzzyuKi3NeF9c=' https://telegram.org; script-src-attr 'none'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob: https:; media-src 'self' blob:; connect-src 'self' wss://pro-chart.ir wss://pro-chart.com; frame-src https://oauth.telegram.org; manifest-src 'self'; upgrade-insecure-requests`
  * Other Info: `style-src includes unsafe-inline.`
* URL: https://prochart-pc130-final-20260715t002005z/
  * Node Name: `https://prochart-pc130-final-20260715t002005z/`
  * Method: `GET`
  * Parameter: `Content-Security-Policy`
  * Attack: ``
  * Evidence: `default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'unsafe-eval' 'sha256-aF/iCowKFbkBQV8blW86a4NG08HFM7xzzyuKi3NeF9c=' https://telegram.org; script-src-attr 'none'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob: https:; media-src 'self' blob:; connect-src 'self' wss://pro-chart.ir wss://pro-chart.com; frame-src https://oauth.telegram.org; manifest-src 'self'; upgrade-insecure-requests`
  * Other Info: `style-src includes unsafe-inline.`
* URL: https://prochart-pc130-final-20260715t002005z/live/
  * Node Name: `https://prochart-pc130-final-20260715t002005z/live/`
  * Method: `GET`
  * Parameter: `Content-Security-Policy`
  * Attack: ``
  * Evidence: `default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'unsafe-eval' 'sha256-aF/iCowKFbkBQV8blW86a4NG08HFM7xzzyuKi3NeF9c=' https://telegram.org; script-src-attr 'none'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob: https:; media-src 'self' blob:; connect-src 'self' wss://pro-chart.ir wss://pro-chart.com; frame-src https://oauth.telegram.org; manifest-src 'self'; upgrade-insecure-requests`
  * Other Info: `style-src includes unsafe-inline.`


Instances: 3

### Solution

Ensure that your web server, application server, load balancer, etc. is properly configured to set the Content-Security-Policy header.

### Reference


* [ https://www.w3.org/TR/CSP/ ](https://www.w3.org/TR/CSP/)
* [ https://caniuse.com/#search=content+security+policy ](https://caniuse.com/#search=content+security+policy)
* [ https://content-security-policy.com/ ](https://content-security-policy.com/)
* [ https://github.com/HtmlUnit/htmlunit-csp ](https://github.com/HtmlUnit/htmlunit-csp)
* [ https://web.dev/articles/csp#resource-options ](https://web.dev/articles/csp#resource-options)


#### CWE Id: [ 693 ](https://cwe.mitre.org/data/definitions/693.html)


#### WASC Id: 15

#### Source ID: 3

### [ Cross-Origin-Embedder-Policy Header Missing or Invalid ](https://www.zaproxy.org/docs/alerts/90004/)



##### Low (Medium)

### Description

Cross-Origin-Embedder-Policy header is a response header that prevents a document from loading any cross-origin resources that don't explicitly grant the document permission (using CORP or CORS).

* URL: https://prochart-pc130-final-20260715T002005Z/sitemap.xml
  * Node Name: `https://prochart-pc130-final-20260715T002005Z/sitemap.xml`
  * Method: `GET`
  * Parameter: `Cross-Origin-Embedder-Policy`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``
* URL: https://prochart-pc130-final-20260715t002005z/*%3Fa
  * Node Name: `https://prochart-pc130-final-20260715t002005z/* (a)`
  * Method: `GET`
  * Parameter: `Cross-Origin-Embedder-Policy`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``


Instances: 2

### Solution

Ensure that the application/web server sets the Cross-Origin-Embedder-Policy header appropriately, and that it sets the Cross-Origin-Embedder-Policy header to 'require-corp' for documents.
If possible, ensure that the end user uses a standards-compliant and modern web browser that supports the Cross-Origin-Embedder-Policy header (https://caniuse.com/mdn-http_headers_cross-origin-embedder-policy).

### Reference


* [ https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Embedder-Policy ](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Embedder-Policy)


#### CWE Id: [ 693 ](https://cwe.mitre.org/data/definitions/693.html)


#### WASC Id: 14

#### Source ID: 3

### [ Cross-Origin-Opener-Policy Header Missing or Invalid ](https://www.zaproxy.org/docs/alerts/90004/)



##### Low (Medium)

### Description

Cross-Origin-Opener-Policy header is a response header that allows a site to control if others included documents share the same browsing context. Sharing the same browsing context with untrusted documents might lead to data leak.

* URL: https://prochart-pc130-final-20260715T002005Z/sitemap.xml
  * Node Name: `https://prochart-pc130-final-20260715T002005Z/sitemap.xml`
  * Method: `GET`
  * Parameter: `Cross-Origin-Opener-Policy`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``
* URL: https://prochart-pc130-final-20260715t002005z/*%3Fa
  * Node Name: `https://prochart-pc130-final-20260715t002005z/* (a)`
  * Method: `GET`
  * Parameter: `Cross-Origin-Opener-Policy`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``


Instances: 2

### Solution

Ensure that the application/web server sets the Cross-Origin-Opener-Policy header appropriately, and that it sets the Cross-Origin-Opener-Policy header to 'same-origin' for documents.
'same-origin-allow-popups' is considered as less secured and should be avoided.
If possible, ensure that the end user uses a standards-compliant and modern web browser that supports the Cross-Origin-Opener-Policy header (https://caniuse.com/mdn-http_headers_cross-origin-opener-policy).

### Reference


* [ https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Opener-Policy ](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Opener-Policy)


#### CWE Id: [ 693 ](https://cwe.mitre.org/data/definitions/693.html)


#### WASC Id: 14

#### Source ID: 3

### [ Cross-Origin-Resource-Policy Header Missing or Invalid ](https://www.zaproxy.org/docs/alerts/90004/)



##### Low (Medium)

### Description

Cross-Origin-Resource-Policy header is an opt-in header designed to counter side-channels attacks like Spectre. Resource should be specifically set as shareable amongst different origins.

* URL: https://prochart-pc130-final-20260715T002005Z/robots.txt
  * Node Name: `https://prochart-pc130-final-20260715T002005Z/robots.txt`
  * Method: `GET`
  * Parameter: `Cross-Origin-Resource-Policy`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``
* URL: https://prochart-pc130-final-20260715T002005Z/sitemap.xml
  * Node Name: `https://prochart-pc130-final-20260715T002005Z/sitemap.xml`
  * Method: `GET`
  * Parameter: `Cross-Origin-Resource-Policy`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``
* URL: https://prochart-pc130-final-20260715t002005z/*%3Fa
  * Node Name: `https://prochart-pc130-final-20260715t002005z/* (a)`
  * Method: `GET`
  * Parameter: `Cross-Origin-Resource-Policy`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``
* URL: https://prochart-pc130-final-20260715t002005z/fonts/anjoman.css
  * Node Name: `https://prochart-pc130-final-20260715t002005z/fonts/anjoman.css`
  * Method: `GET`
  * Parameter: `Cross-Origin-Resource-Policy`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``
* URL: https://prochart-pc130-final-20260715t002005z/fonts/iranyekanx.css
  * Node Name: `https://prochart-pc130-final-20260715t002005z/fonts/iranyekanx.css`
  * Method: `GET`
  * Parameter: `Cross-Origin-Resource-Policy`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``
* URL: https://prochart-pc130-final-20260715t002005z/fonts/vazirmatn.css
  * Node Name: `https://prochart-pc130-final-20260715t002005z/fonts/vazirmatn.css`
  * Method: `GET`
  * Parameter: `Cross-Origin-Resource-Policy`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``
* URL: https://prochart-pc130-final-20260715t002005z/manifest.webmanifest
  * Node Name: `https://prochart-pc130-final-20260715t002005z/manifest.webmanifest`
  * Method: `GET`
  * Parameter: `Cross-Origin-Resource-Policy`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``

Instances: Systemic


### Solution

Ensure that the application/web server sets the Cross-Origin-Resource-Policy header appropriately, and that it sets the Cross-Origin-Resource-Policy header to 'same-origin' for all web pages.
'same-site' is considered as less secured and should be avoided.
If resources must be shared, set the header to 'cross-origin'.
If possible, ensure that the end user uses a standards-compliant and modern web browser that supports the Cross-Origin-Resource-Policy header (https://caniuse.com/mdn-http_headers_cross-origin-resource-policy).

### Reference


* [ https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Embedder-Policy ](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Embedder-Policy)


#### CWE Id: [ 693 ](https://cwe.mitre.org/data/definitions/693.html)


#### WASC Id: 14

#### Source ID: 3

### [ Server Leaks Version Information via "Server" HTTP Response Header Field ](https://www.zaproxy.org/docs/alerts/10036/)



##### Low (High)

### Description

The web/application server is leaking version information via the "Server" HTTP response header. Access to such information may facilitate attackers identifying other vulnerabilities your web/application server is subject to.

* URL: https://prochart-pc130-final-20260715T002005Z
  * Node Name: `https://prochart-pc130-final-20260715T002005Z`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `nginx/1.27.5`
  * Other Info: ``
* URL: https://prochart-pc130-final-20260715T002005Z/robots.txt
  * Node Name: `https://prochart-pc130-final-20260715T002005Z/robots.txt`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `nginx/1.27.5`
  * Other Info: ``
* URL: https://prochart-pc130-final-20260715T002005Z/sitemap.xml
  * Node Name: `https://prochart-pc130-final-20260715T002005Z/sitemap.xml`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `nginx/1.27.5`
  * Other Info: ``
* URL: https://prochart-pc130-final-20260715t002005z/
  * Node Name: `https://prochart-pc130-final-20260715t002005z/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `nginx/1.27.5`
  * Other Info: ``
* URL: https://prochart-pc130-final-20260715t002005z/api/
  * Node Name: `https://prochart-pc130-final-20260715t002005z/api/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `nginx/1.27.5`
  * Other Info: ``
* URL: https://prochart-pc130-final-20260715t002005z/fonts/iranyekanx.css
  * Node Name: `https://prochart-pc130-final-20260715t002005z/fonts/iranyekanx.css`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `nginx/1.27.5`
  * Other Info: ``
* URL: https://prochart-pc130-final-20260715t002005z/live/
  * Node Name: `https://prochart-pc130-final-20260715t002005z/live/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `nginx/1.27.5`
  * Other Info: ``
* URL: https://prochart-pc130-final-20260715t002005z/manifest.webmanifest
  * Node Name: `https://prochart-pc130-final-20260715t002005z/manifest.webmanifest`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `nginx/1.27.5`
  * Other Info: ``

Instances: Systemic


### Solution

Ensure that your web server, application server, load balancer, etc. is configured to suppress the "Server" header or provide generic details.

### Reference


* [ https://httpd.apache.org/docs/current/mod/core.html#servertokens ](https://httpd.apache.org/docs/current/mod/core.html#servertokens)
* [ https://learn.microsoft.com/en-us/previous-versions/msp-n-p/ff648552(v=pandp.10) ](https://learn.microsoft.com/en-us/previous-versions/msp-n-p/ff648552(v=pandp.10))
* [ https://www.troyhunt.com/shhh-dont-let-your-response-headers/ ](https://www.troyhunt.com/shhh-dont-let-your-response-headers/)


#### CWE Id: [ 497 ](https://cwe.mitre.org/data/definitions/497.html)


#### WASC Id: 13

#### Source ID: 3

### [ Modern Web Application ](https://www.zaproxy.org/docs/alerts/10109/)



##### Informational (Medium)

### Description

The application appears to be a modern web application. If you need to explore it automatically then the Client Spider may well be more effective than the standard one.

* URL: https://prochart-pc130-final-20260715T002005Z
  * Node Name: `https://prochart-pc130-final-20260715T002005Z`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `<script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "WebSite",
          "name": "بازارنما",
          "url": "https://pro-chart.com/",
          "inLanguage": "fa-IR",
          "potentialAction": {
            "@type": "SearchAction",
            "target": "https://pro-chart.com/market?q={search_term_string}",
            "query-input": "required name=search_term_string"
          }
        },
        {
          "@type": "Organization",
          "name": "بازارنما",
          "url": "https://pro-chart.com/",
          "description": "بازارنما پلتفرم حرفه‌ای چارت آنلاین و ترید بازارهای مالی به‌سبک تریدینگ‌ویو و کاملاً فارسی است؛ چارت زنده ارز دیجیتال، فارکس و طلا، اندیکاتور، واچ‌لیست، هشدار قیمت، سیگنال هوش مصنوعی و ترید واقعی.",
          "logo": "https://pro-chart.com/logo.png"
        },
        {
          "@type": "SoftwareApplication",
          "name": "بازارنما",
          "url": "https://pro-chart.com/",
          "applicationCategory": "FinanceApplication",
          "operatingSystem": "Web",
          "description": "چارت آنلاین و ترید حرفه‌ای بازارهای مالی؛ نمودار زنده ارز دیجیتال، فارکس و طلا با اندیکاتور، واچ‌لیست، هشدار قیمت و سیگنال هوش مصنوعی.",
          "offers": {
            "@type": "Offer",
            "price": "0",
            "priceCurrency": "IRR"
          }
        }
      ]
    }
    </script>`
  * Other Info: `No links have been found while there are scripts, which is an indication that this is a modern web application.`
* URL: https://prochart-pc130-final-20260715t002005z/
  * Node Name: `https://prochart-pc130-final-20260715t002005z/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `<script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "WebSite",
          "name": "بازارنما",
          "url": "https://pro-chart.com/",
          "inLanguage": "fa-IR",
          "potentialAction": {
            "@type": "SearchAction",
            "target": "https://pro-chart.com/market?q={search_term_string}",
            "query-input": "required name=search_term_string"
          }
        },
        {
          "@type": "Organization",
          "name": "بازارنما",
          "url": "https://pro-chart.com/",
          "description": "بازارنما پلتفرم حرفه‌ای چارت آنلاین و ترید بازارهای مالی به‌سبک تریدینگ‌ویو و کاملاً فارسی است؛ چارت زنده ارز دیجیتال، فارکس و طلا، اندیکاتور، واچ‌لیست، هشدار قیمت، سیگنال هوش مصنوعی و ترید واقعی.",
          "logo": "https://pro-chart.com/logo.png"
        },
        {
          "@type": "SoftwareApplication",
          "name": "بازارنما",
          "url": "https://pro-chart.com/",
          "applicationCategory": "FinanceApplication",
          "operatingSystem": "Web",
          "description": "چارت آنلاین و ترید حرفه‌ای بازارهای مالی؛ نمودار زنده ارز دیجیتال، فارکس و طلا با اندیکاتور، واچ‌لیست، هشدار قیمت و سیگنال هوش مصنوعی.",
          "offers": {
            "@type": "Offer",
            "price": "0",
            "priceCurrency": "IRR"
          }
        }
      ]
    }
    </script>`
  * Other Info: `No links have been found while there are scripts, which is an indication that this is a modern web application.`
* URL: https://prochart-pc130-final-20260715t002005z/*%3Fa
  * Node Name: `https://prochart-pc130-final-20260715t002005z/* (a)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `<script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "WebSite",
          "name": "بازارنما",
          "url": "https://pro-chart.com/",
          "inLanguage": "fa-IR",
          "potentialAction": {
            "@type": "SearchAction",
            "target": "https://pro-chart.com/market?q={search_term_string}",
            "query-input": "required name=search_term_string"
          }
        },
        {
          "@type": "Organization",
          "name": "بازارنما",
          "url": "https://pro-chart.com/",
          "description": "بازارنما پلتفرم حرفه‌ای چارت آنلاین و ترید بازارهای مالی به‌سبک تریدینگ‌ویو و کاملاً فارسی است؛ چارت زنده ارز دیجیتال، فارکس و طلا، اندیکاتور، واچ‌لیست، هشدار قیمت، سیگنال هوش مصنوعی و ترید واقعی.",
          "logo": "https://pro-chart.com/logo.png"
        },
        {
          "@type": "SoftwareApplication",
          "name": "بازارنما",
          "url": "https://pro-chart.com/",
          "applicationCategory": "FinanceApplication",
          "operatingSystem": "Web",
          "description": "چارت آنلاین و ترید حرفه‌ای بازارهای مالی؛ نمودار زنده ارز دیجیتال، فارکس و طلا با اندیکاتور، واچ‌لیست، هشدار قیمت و سیگنال هوش مصنوعی.",
          "offers": {
            "@type": "Offer",
            "price": "0",
            "priceCurrency": "IRR"
          }
        }
      ]
    }
    </script>`
  * Other Info: `No links have been found while there are scripts, which is an indication that this is a modern web application.`
* URL: https://prochart-pc130-final-20260715t002005z/live/
  * Node Name: `https://prochart-pc130-final-20260715t002005z/live/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `<script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "WebSite",
          "name": "بازارنما",
          "url": "https://pro-chart.com/",
          "inLanguage": "fa-IR",
          "potentialAction": {
            "@type": "SearchAction",
            "target": "https://pro-chart.com/market?q={search_term_string}",
            "query-input": "required name=search_term_string"
          }
        },
        {
          "@type": "Organization",
          "name": "بازارنما",
          "url": "https://pro-chart.com/",
          "description": "بازارنما پلتفرم حرفه‌ای چارت آنلاین و ترید بازارهای مالی به‌سبک تریدینگ‌ویو و کاملاً فارسی است؛ چارت زنده ارز دیجیتال، فارکس و طلا، اندیکاتور، واچ‌لیست، هشدار قیمت، سیگنال هوش مصنوعی و ترید واقعی.",
          "logo": "https://pro-chart.com/logo.png"
        },
        {
          "@type": "SoftwareApplication",
          "name": "بازارنما",
          "url": "https://pro-chart.com/",
          "applicationCategory": "FinanceApplication",
          "operatingSystem": "Web",
          "description": "چارت آنلاین و ترید حرفه‌ای بازارهای مالی؛ نمودار زنده ارز دیجیتال، فارکس و طلا با اندیکاتور، واچ‌لیست، هشدار قیمت و سیگنال هوش مصنوعی.",
          "offers": {
            "@type": "Offer",
            "price": "0",
            "priceCurrency": "IRR"
          }
        }
      ]
    }
    </script>`
  * Other Info: `No links have been found while there are scripts, which is an indication that this is a modern web application.`


Instances: 4

### Solution

This is an informational alert and so no changes are required.

### Reference




#### Source ID: 3

### [ Non-Storable Content ](https://www.zaproxy.org/docs/alerts/10049/)



##### Informational (Medium)

### Description

The response contents are not storable by caching components such as proxy servers. If the response does not contain sensitive, personal or user-specific information, it may benefit from being stored and cached, to improve performance.

* URL: https://prochart-pc130-final-20260715t002005z/*%3Fa
  * Node Name: `https://prochart-pc130-final-20260715t002005z/* (a)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `no-store`
  * Other Info: ``
* URL: https://prochart-pc130-final-20260715t002005z/live/
  * Node Name: `https://prochart-pc130-final-20260715t002005z/live/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `no-store`
  * Other Info: ``
* URL: https://prochart-pc130-final-20260715t002005z/manifest.webmanifest
  * Node Name: `https://prochart-pc130-final-20260715t002005z/manifest.webmanifest`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `no-store`
  * Other Info: ``


Instances: 3

### Solution

The content may be marked as storable by ensuring that the following conditions are satisfied:
The request method must be understood by the cache and defined as being cacheable ("GET", "HEAD", and "POST" are currently defined as cacheable)
The response status code must be understood by the cache (one of the 1XX, 2XX, 3XX, 4XX, or 5XX response classes are generally understood)
The "no-store" cache directive must not appear in the request or response header fields
For caching by "shared" caches such as "proxy" caches, the "private" response directive must not appear in the response
For caching by "shared" caches such as "proxy" caches, the "Authorization" header field must not appear in the request, unless the response explicitly allows it (using one of the "must-revalidate", "public", or "s-maxage" Cache-Control response directives)
In addition to the conditions above, at least one of the following conditions must also be satisfied by the response:
It must contain an "Expires" header field
It must contain a "max-age" response directive
For "shared" caches such as "proxy" caches, it must contain a "s-maxage" response directive
It must contain a "Cache Control Extension" that allows it to be cached
It must have a status code that is defined as cacheable by default (200, 203, 204, 206, 300, 301, 404, 405, 410, 414, 501).

### Reference


* [ https://datatracker.ietf.org/doc/html/rfc7234 ](https://datatracker.ietf.org/doc/html/rfc7234)
* [ https://datatracker.ietf.org/doc/html/rfc7231 ](https://datatracker.ietf.org/doc/html/rfc7231)
* [ https://www.w3.org/Protocols/rfc2616/rfc2616-sec13.html ](https://www.w3.org/Protocols/rfc2616/rfc2616-sec13.html)


#### CWE Id: [ 524 ](https://cwe.mitre.org/data/definitions/524.html)


#### WASC Id: 13

#### Source ID: 3

### [ Re-examine Cache-control Directives ](https://www.zaproxy.org/docs/alerts/10015/)



##### Informational (Low)

### Description

The cache-control header has not been set properly or is missing, allowing the browser and proxies to cache content. For static assets like css, js, or image files this might be intended, however, the resources should be reviewed to ensure that no sensitive content will be cached.

* URL: https://prochart-pc130-final-20260715T002005Z/robots.txt
  * Node Name: `https://prochart-pc130-final-20260715T002005Z/robots.txt`
  * Method: `GET`
  * Parameter: `cache-control`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``
* URL: https://prochart-pc130-final-20260715T002005Z/sitemap.xml
  * Node Name: `https://prochart-pc130-final-20260715T002005Z/sitemap.xml`
  * Method: `GET`
  * Parameter: `cache-control`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``


Instances: 2

### Solution

For secure content, ensure the cache-control HTTP header is set with "no-cache, no-store, must-revalidate". If an asset should be cached consider setting the directives "public, max-age, immutable".

### Reference


* [ https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html#web-content-caching ](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html#web-content-caching)
* [ https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control ](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control)
* [ https://grayduck.mn/2021/09/13/cache-control-recommendations/ ](https://grayduck.mn/2021/09/13/cache-control-recommendations/)


#### CWE Id: [ 525 ](https://cwe.mitre.org/data/definitions/525.html)


#### WASC Id: 13

#### Source ID: 3

### [ Storable and Cacheable Content ](https://www.zaproxy.org/docs/alerts/10049/)



##### Informational (Medium)

### Description

The response contents are storable by caching components such as proxy servers, and may be retrieved directly from the cache, rather than from the origin server by the caching servers, in response to similar requests from other users. If the response data is sensitive, personal or user-specific, this may result in sensitive information being leaked. In some cases, this may even result in a user gaining complete control of the session of another user, depending on the configuration of the caching components in use in their environment. This is primarily an issue where "shared" caching servers such as "proxy" caches are configured on the local network. This configuration is typically found in corporate or educational environments, for instance.

* URL: https://prochart-pc130-final-20260715T002005Z/robots.txt
  * Node Name: `https://prochart-pc130-final-20260715T002005Z/robots.txt`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: ``
  * Other Info: `In the absence of an explicitly specified caching lifetime directive in the response, a liberal lifetime heuristic of 1 year was assumed. This is permitted by rfc7234.`
* URL: https://prochart-pc130-final-20260715T002005Z/sitemap.xml
  * Node Name: `https://prochart-pc130-final-20260715T002005Z/sitemap.xml`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: ``
  * Other Info: `In the absence of an explicitly specified caching lifetime directive in the response, a liberal lifetime heuristic of 1 year was assumed. This is permitted by rfc7234.`
* URL: https://prochart-pc130-final-20260715t002005z/api/
  * Node Name: `https://prochart-pc130-final-20260715t002005z/api/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: ``
  * Other Info: `In the absence of an explicitly specified caching lifetime directive in the response, a liberal lifetime heuristic of 1 year was assumed. This is permitted by rfc7234.`
* URL: https://prochart-pc130-final-20260715t002005z/fonts/anjoman.css
  * Node Name: `https://prochart-pc130-final-20260715t002005z/fonts/anjoman.css`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `max-age=31536000`
  * Other Info: ``
* URL: https://prochart-pc130-final-20260715t002005z/fonts/iranyekanx.css
  * Node Name: `https://prochart-pc130-final-20260715t002005z/fonts/iranyekanx.css`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `max-age=31536000`
  * Other Info: ``
* URL: https://prochart-pc130-final-20260715t002005z/fonts/ravagh.css
  * Node Name: `https://prochart-pc130-final-20260715t002005z/fonts/ravagh.css`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `max-age=31536000`
  * Other Info: ``
* URL: https://prochart-pc130-final-20260715t002005z/fonts/vazirmatn.css
  * Node Name: `https://prochart-pc130-final-20260715t002005z/fonts/vazirmatn.css`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `max-age=31536000`
  * Other Info: ``

Instances: Systemic


### Solution

Validate that the response does not contain sensitive, personal or user-specific information. If it does, consider the use of the following HTTP response headers, to limit, or prevent the content being stored and retrieved from the cache by another user:
Cache-Control: no-cache, no-store, must-revalidate, private
Pragma: no-cache
Expires: 0
This configuration directs both HTTP 1.0 and HTTP 1.1 compliant caching servers to not store the response, and to not retrieve the response (without validation) from the cache, in response to a similar request.

### Reference


* [ https://datatracker.ietf.org/doc/html/rfc7234 ](https://datatracker.ietf.org/doc/html/rfc7234)
* [ https://datatracker.ietf.org/doc/html/rfc7231 ](https://datatracker.ietf.org/doc/html/rfc7231)
* [ https://www.w3.org/Protocols/rfc2616/rfc2616-sec13.html ](https://www.w3.org/Protocols/rfc2616/rfc2616-sec13.html)


#### CWE Id: [ 524 ](https://cwe.mitre.org/data/definitions/524.html)


#### WASC Id: 13

#### Source ID: 3


