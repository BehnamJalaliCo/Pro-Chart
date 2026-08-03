# ZAP Scanning Report

ZAP by [Checkmarx](https://checkmarx.com/).


## Summary of Alerts

| Risk Level | Number of Alerts |
| --- | --- |
| High | 0 |
| Medium | 3 |
| Low | 4 |
| Informational | 8 |




## Insights

| Level | Reason | Site | Description | Statistic |
| --- | --- | --- | --- | --- |
| Low | Warning |  | ZAP warnings logged - see the zap.log file for details | 4    |
| Info | Informational | https://pcsec-front-20260715t012839z | Percentage of responses with status code 2xx | 83 % |
| Info | Informational | https://pcsec-front-20260715t012839z | Percentage of responses with status code 4xx | 16 % |
| Info | Informational | https://pcsec-front-20260715t012839z | Percentage of endpoints with content type application/javascript | 10 % |
| Info | Informational | https://pcsec-front-20260715t012839z | Percentage of endpoints with content type application/json | 20 % |
| Info | Informational | https://pcsec-front-20260715t012839z | Percentage of endpoints with content type application/octet-stream | 10 % |
| Info | Informational | https://pcsec-front-20260715t012839z | Percentage of endpoints with content type image/png | 10 % |
| Info | Informational | https://pcsec-front-20260715t012839z | Percentage of endpoints with content type text/css | 50 % |
| Info | Informational | https://pcsec-front-20260715t012839z | Percentage of endpoints with method GET | 100 % |
| Info | Informational | https://pcsec-front-20260715t012839z | Count of total endpoints | 10    |







## Alerts

| Name | Risk Level | Number of Instances |
| --- | --- | --- |
| CSP: Wildcard Directive | Medium | 1 |
| CSP: script-src unsafe-eval | Medium | 1 |
| CSP: style-src unsafe-inline | Medium | 1 |
| Cross-Origin-Embedder-Policy Header Missing or Invalid | Low | 1 |
| Cross-Origin-Opener-Policy Header Missing or Invalid | Low | 1 |
| Cross-Origin-Resource-Policy Header Missing or Invalid | Low | Systemic |
| Server Leaks Version Information via "Server" HTTP Response Header Field | Low | Systemic |
| Base64 Disclosure | Informational | 1 |
| Modern Web Application | Informational | 1 |
| Non-Storable Content | Informational | 2 |
| Sec-Fetch-Dest Header is Missing | Informational | Systemic |
| Sec-Fetch-Mode Header is Missing | Informational | Systemic |
| Sec-Fetch-Site Header is Missing | Informational | Systemic |
| Sec-Fetch-User Header is Missing | Informational | Systemic |
| Storable and Cacheable Content | Informational | Systemic |




## Alert Detail



### [ CSP: Wildcard Directive ](https://www.zaproxy.org/docs/alerts/10055/)



##### Medium (High)

### Description

Content Security Policy (CSP) is an added layer of security that helps to detect and mitigate certain types of attacks. Including (but not limited to) Cross Site Scripting (XSS), and data injection attacks. These attacks are used for everything from data theft to site defacement or distribution of malware. CSP provides a set of standard HTTP headers that allow website owners to declare approved sources of content that browsers should be allowed to load on that page — covered types are JavaScript, CSS, HTML frames, fonts, images and embeddable objects such as Java applets, ActiveX, audio and video files.

* URL: https://pcsec-front-20260715t012839z
  * Node Name: `https://pcsec-front-20260715t012839z`
  * Method: `GET`
  * Parameter: `Content-Security-Policy`
  * Attack: ``
  * Evidence: `default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'unsafe-eval' 'sha256-aF/iCowKFbkBQV8blW86a4NG08HFM7xzzyuKi3NeF9c=' https://telegram.org; script-src-attr 'none'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob: https:; media-src 'self' blob:; connect-src 'self' wss://pro-chart.ir wss://pro-chart.com; frame-src https://oauth.telegram.org; manifest-src 'self'; upgrade-insecure-requests`
  * Other Info: `The following directives either allow wildcard sources (or ancestors), are not defined, or are overly broadly defined:
img-src`


Instances: 1

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

* URL: https://pcsec-front-20260715t012839z
  * Node Name: `https://pcsec-front-20260715t012839z`
  * Method: `GET`
  * Parameter: `Content-Security-Policy`
  * Attack: ``
  * Evidence: `default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'unsafe-eval' 'sha256-aF/iCowKFbkBQV8blW86a4NG08HFM7xzzyuKi3NeF9c=' https://telegram.org; script-src-attr 'none'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob: https:; media-src 'self' blob:; connect-src 'self' wss://pro-chart.ir wss://pro-chart.com; frame-src https://oauth.telegram.org; manifest-src 'self'; upgrade-insecure-requests`
  * Other Info: `script-src includes unsafe-eval.`


Instances: 1

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

* URL: https://pcsec-front-20260715t012839z
  * Node Name: `https://pcsec-front-20260715t012839z`
  * Method: `GET`
  * Parameter: `Content-Security-Policy`
  * Attack: ``
  * Evidence: `default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'unsafe-eval' 'sha256-aF/iCowKFbkBQV8blW86a4NG08HFM7xzzyuKi3NeF9c=' https://telegram.org; script-src-attr 'none'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob: https:; media-src 'self' blob:; connect-src 'self' wss://pro-chart.ir wss://pro-chart.com; frame-src https://oauth.telegram.org; manifest-src 'self'; upgrade-insecure-requests`
  * Other Info: `style-src includes unsafe-inline.`


Instances: 1

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

* URL: https://pcsec-front-20260715t012839z
  * Node Name: `https://pcsec-front-20260715t012839z`
  * Method: `GET`
  * Parameter: `Cross-Origin-Embedder-Policy`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``


Instances: 1

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

* URL: https://pcsec-front-20260715t012839z
  * Node Name: `https://pcsec-front-20260715t012839z`
  * Method: `GET`
  * Parameter: `Cross-Origin-Opener-Policy`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``


Instances: 1

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

* URL: https://pcsec-front-20260715t012839z/fonts/anjoman.css
  * Node Name: `https://pcsec-front-20260715t012839z/fonts/anjoman.css`
  * Method: `GET`
  * Parameter: `Cross-Origin-Resource-Policy`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``
* URL: https://pcsec-front-20260715t012839z/fonts/iranyekanx.css
  * Node Name: `https://pcsec-front-20260715t012839z/fonts/iranyekanx.css`
  * Method: `GET`
  * Parameter: `Cross-Origin-Resource-Policy`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``
* URL: https://pcsec-front-20260715t012839z/fonts/ravagh.css
  * Node Name: `https://pcsec-front-20260715t012839z/fonts/ravagh.css`
  * Method: `GET`
  * Parameter: `Cross-Origin-Resource-Policy`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``
* URL: https://pcsec-front-20260715t012839z/fonts/vazirmatn.css
  * Node Name: `https://pcsec-front-20260715t012839z/fonts/vazirmatn.css`
  * Method: `GET`
  * Parameter: `Cross-Origin-Resource-Policy`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``
* URL: https://pcsec-front-20260715t012839z/manifest.webmanifest
  * Node Name: `https://pcsec-front-20260715t012839z/manifest.webmanifest`
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

* URL: https://pcsec-front-20260715t012839z/fonts/ravagh.css
  * Node Name: `https://pcsec-front-20260715t012839z/fonts/ravagh.css`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `nginx/1.27.5`
  * Other Info: ``
* URL: https://pcsec-front-20260715t012839z/fonts/vazirmatn.css
  * Node Name: `https://pcsec-front-20260715t012839z/fonts/vazirmatn.css`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `nginx/1.27.5`
  * Other Info: ``
* URL: https://pcsec-front-20260715t012839z/manifest.webmanifest
  * Node Name: `https://pcsec-front-20260715t012839z/manifest.webmanifest`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `nginx/1.27.5`
  * Other Info: ``
* URL: https://pcsec-front-20260715t012839z/sitemap.xml
  * Node Name: `https://pcsec-front-20260715t012839z/sitemap.xml`
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

### [ Base64 Disclosure ](https://www.zaproxy.org/docs/alerts/10094/)



##### Informational (Medium)

### Description

Base64 encoded data was disclosed by the application/web server. Note: in the interests of performance not all base64 strings in the response were analyzed individually, the entire response should be looked at by the analyst/security team/developer(s).

* URL: https://pcsec-front-20260715t012839z/logo.png
  * Node Name: `https://pcsec-front-20260715t012839z/logo.png`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `MIIEHgoBAKCCBBcwggQTBgkrBgEFBQcwAQEEggQEMIIEADCBoqIWBBSDDJFNc+9OUgVUSGsrQpSFczzd/BgPMjAyNjA2MjUxNzI0MjNaMHcwdTBNMAkGBSsOAwIaBQAEFD5MfI5QC4dscxW+r26X6hDulCDJBBTDsySWNJOhWepSGGueF+CputawTAIUUpQlB4G1aob5Mxd4cNaOre9iGkGAABgPMjAyNjA2MjUxNzI0MjBaoBEYDzIwMjYwNzAyMTcyNDIwWjAKBggqhkjOPQQDAgNJADBGAiEA7LzwFb7UnkUq6ZgbtBWOB5FiycNYHdIFFS7vxF6jzbsCIQCCrNqWa50guEyV7IuXpr+kNEMno41xsogfmLrXukml16CCAwAwggL8MIIC+DCCAn6gAwIBAgIUYEAJzJ3SPfG/P2leyXgXSUzvKTAwCgYIKoZIzj0EAwMwgacxCzAJBgNVBAYTAlVTMREwDwYDVQQIDAhOZXcgWW9yazERMA8GA1UEBwwITmV3IFlvcmsxEzARBgNVBAoMClRydWZvIEluYy4xFDASBgNVBAsMC0NBIERpdmlzaW9uMRowGAYJKoZIhvcNAQkBFgtjYUB0cnVmby5haTErMCkGA1UEAwwiVHJ1Zm8gQzJQQSBDbGFpbSBTaWduaW5nIENBICgyMDI1KTAeFw0yNjA2MTcwMDAzMjFaFw0yNjA3MTcwMDAzMjFaMIGlMQswCQYDVQQGEwJVUzERMA8GA1UECAwITmV3IFlvcmsxETAPBgNVBAcMCE5ldyBZb3JrMRMwEQYDVQQKDApUcnVmbyBJbmMuMRQwEgYDVQQLDAtDQSBEaXZpc2lvbjEaMBgGCSqGSIb3DQEJARYLY2FAdHJ1Zm8uYWkxKTAnBgNVBAMMIFRydWZvIEMyUEEgT0NTUCBSZXNwb25kZXIgKDIwMjUpMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE7784BCw0q/JNsPdnlH7WSKhqED6qtX7XtfyyWZ+QollYkHFRNeR3BSzWMZsa8o+AXGPIrSmICAzA2DXDdmC6GaOBhzCBhDAdBgNVHQ4EFgQUgwyRTXPvTlIFVEhrK0KUhXM83fwwHwYDVR0jBBgwFoAUw7MkljSToVnqUhhrnhfgqbrWsEwwDAYDVR0TAQH/BAIwADAOBgNVHQ8BAf8EBAMCB4AwEwYDVR0lBAwwCgYIKwYBBQUHAwkwDwYJKwYBBQUHMAEFBAIFADAKBggqhkjOPQQDAwNoADBlAjEAmWNh+x/mitkZOVyOf90VakSBfD4NDF+cR2xp6d9xlwjqZegDnVoGihgImjGnrVV7AjBONzz6S4G4IwVYGk+TmaE9mzWDG9yEahdJthaP36gQRdCvv6m/ihLYW6LjuadYb2w=`
  * Other Info: `0�
 ��0�	+0�0� 0�����Ms�NRTHk+B��s<��20260625172423Z0w0u0M0	+ >L|�P�ls��n��� �ó$�4��Y�Rk�੺ְLR�%��j��3xp֎��bA� 20260625172420Z�20260702172420Z0
*�H�=I 0F! ���ԞE*����b��X�.��^�ͻ! ��ږk� �L�싗���4C'��q����׺I�נ� 0��0��0�~�`@	̝�=�?i^�xIL�)00
*�H�=0��10	UUS10UNew York10UNew York10U

Trufo Inc.10UCA Division10	*�H��	ca@trufo.ai1+0)U"Trufo C2PA Claim Signing CA (2025)0260617000321Z260717000321Z0��10	UUS10UNew York10UNew York10U

Trufo Inc.10UCA Division10	*�H��	ca@trufo.ai1)0'U Trufo C2PA OCSP Responder (2025)0Y0*�H�=*�H�=B �8,4��M��g�~�H�j>��~׵��Y���YX�qQ5�w,�1��\cȭ)���5�v`����0��0U��Ms�NRTHk+B��s<��0U#0�ó$�4��Y�Rk�੺ְL0U�0 0U��0U%0
+	0	+0 0
*�H�=h 0e1 �ca���9\��jD�|>_�Gli��q��e��Z��1��U{0N7<�K��#XO���=�5�܄jI��ߨEЯ�����[�㹧Xol`


Instances: 1

### Solution

Manually confirm that the Base64 data does not leak sensitive information, and that the data cannot be aggregated/used to exploit other vulnerabilities.

### Reference


* [ https://projects.webappsec.org/w/page/13246936/Information%20Leakage ](https://projects.webappsec.org/w/page/13246936/Information%20Leakage)


#### CWE Id: [ 319 ](https://cwe.mitre.org/data/definitions/319.html)


#### WASC Id: 13

#### Source ID: 3

### [ Modern Web Application ](https://www.zaproxy.org/docs/alerts/10109/)



##### Informational (Medium)

### Description

The application appears to be a modern web application. If you need to explore it automatically then the Client Spider may well be more effective than the standard one.

* URL: https://pcsec-front-20260715t012839z
  * Node Name: `https://pcsec-front-20260715t012839z`
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


Instances: 1

### Solution

This is an informational alert and so no changes are required.

### Reference




#### Source ID: 3

### [ Non-Storable Content ](https://www.zaproxy.org/docs/alerts/10049/)



##### Informational (Medium)

### Description

The response contents are not storable by caching components such as proxy servers. If the response does not contain sensitive, personal or user-specific information, it may benefit from being stored and cached, to improve performance.

* URL: https://pcsec-front-20260715t012839z
  * Node Name: `https://pcsec-front-20260715t012839z`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `no-store`
  * Other Info: ``
* URL: https://pcsec-front-20260715t012839z/manifest.webmanifest
  * Node Name: `https://pcsec-front-20260715t012839z/manifest.webmanifest`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `no-store`
  * Other Info: ``


Instances: 2

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

### [ Sec-Fetch-Dest Header is Missing ](https://www.zaproxy.org/docs/alerts/90005/)



##### Informational (High)

### Description

Specifies how and where the data would be used. For instance, if the value is audio, then the requested resource must be audio data and not any other type of resource.

* URL: https://pcsec-front-20260715t012839z/fonts/iranyekanx.css
  * Node Name: `https://pcsec-front-20260715t012839z/fonts/iranyekanx.css`
  * Method: `GET`
  * Parameter: `Sec-Fetch-Dest`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``
* URL: https://pcsec-front-20260715t012839z/fonts/ravagh.css
  * Node Name: `https://pcsec-front-20260715t012839z/fonts/ravagh.css`
  * Method: `GET`
  * Parameter: `Sec-Fetch-Dest`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``
* URL: https://pcsec-front-20260715t012839z/manifest.webmanifest
  * Node Name: `https://pcsec-front-20260715t012839z/manifest.webmanifest`
  * Method: `GET`
  * Parameter: `Sec-Fetch-Dest`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``
* URL: https://pcsec-front-20260715t012839z/robots.txt
  * Node Name: `https://pcsec-front-20260715t012839z/robots.txt`
  * Method: `GET`
  * Parameter: `Sec-Fetch-Dest`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``
* URL: https://pcsec-front-20260715t012839z/sitemap.xml
  * Node Name: `https://pcsec-front-20260715t012839z/sitemap.xml`
  * Method: `GET`
  * Parameter: `Sec-Fetch-Dest`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``

Instances: Systemic


### Solution

Ensure that Sec-Fetch-Dest header is included in request headers.

### Reference


* [ https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Sec-Fetch-Dest ](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Sec-Fetch-Dest)


#### CWE Id: [ 352 ](https://cwe.mitre.org/data/definitions/352.html)


#### WASC Id: 9

#### Source ID: 3

### [ Sec-Fetch-Mode Header is Missing ](https://www.zaproxy.org/docs/alerts/90005/)



##### Informational (High)

### Description

Allows to differentiate between requests for navigating between HTML pages and requests for loading resources like images, audio etc.

* URL: https://pcsec-front-20260715t012839z/fonts/iranyekanx.css
  * Node Name: `https://pcsec-front-20260715t012839z/fonts/iranyekanx.css`
  * Method: `GET`
  * Parameter: `Sec-Fetch-Mode`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``
* URL: https://pcsec-front-20260715t012839z/fonts/ravagh.css
  * Node Name: `https://pcsec-front-20260715t012839z/fonts/ravagh.css`
  * Method: `GET`
  * Parameter: `Sec-Fetch-Mode`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``
* URL: https://pcsec-front-20260715t012839z/manifest.webmanifest
  * Node Name: `https://pcsec-front-20260715t012839z/manifest.webmanifest`
  * Method: `GET`
  * Parameter: `Sec-Fetch-Mode`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``
* URL: https://pcsec-front-20260715t012839z/robots.txt
  * Node Name: `https://pcsec-front-20260715t012839z/robots.txt`
  * Method: `GET`
  * Parameter: `Sec-Fetch-Mode`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``
* URL: https://pcsec-front-20260715t012839z/sitemap.xml
  * Node Name: `https://pcsec-front-20260715t012839z/sitemap.xml`
  * Method: `GET`
  * Parameter: `Sec-Fetch-Mode`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``

Instances: Systemic


### Solution

Ensure that Sec-Fetch-Mode header is included in request headers.

### Reference


* [ https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Sec-Fetch-Mode ](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Sec-Fetch-Mode)


#### CWE Id: [ 352 ](https://cwe.mitre.org/data/definitions/352.html)


#### WASC Id: 9

#### Source ID: 3

### [ Sec-Fetch-Site Header is Missing ](https://www.zaproxy.org/docs/alerts/90005/)



##### Informational (High)

### Description

Specifies the relationship between request initiator's origin and target's origin.

* URL: https://pcsec-front-20260715t012839z/fonts/iranyekanx.css
  * Node Name: `https://pcsec-front-20260715t012839z/fonts/iranyekanx.css`
  * Method: `GET`
  * Parameter: `Sec-Fetch-Site`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``
* URL: https://pcsec-front-20260715t012839z/fonts/ravagh.css
  * Node Name: `https://pcsec-front-20260715t012839z/fonts/ravagh.css`
  * Method: `GET`
  * Parameter: `Sec-Fetch-Site`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``
* URL: https://pcsec-front-20260715t012839z/manifest.webmanifest
  * Node Name: `https://pcsec-front-20260715t012839z/manifest.webmanifest`
  * Method: `GET`
  * Parameter: `Sec-Fetch-Site`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``
* URL: https://pcsec-front-20260715t012839z/robots.txt
  * Node Name: `https://pcsec-front-20260715t012839z/robots.txt`
  * Method: `GET`
  * Parameter: `Sec-Fetch-Site`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``
* URL: https://pcsec-front-20260715t012839z/sitemap.xml
  * Node Name: `https://pcsec-front-20260715t012839z/sitemap.xml`
  * Method: `GET`
  * Parameter: `Sec-Fetch-Site`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``

Instances: Systemic


### Solution

Ensure that Sec-Fetch-Site header is included in request headers.

### Reference


* [ https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Sec-Fetch-Site ](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Sec-Fetch-Site)


#### CWE Id: [ 352 ](https://cwe.mitre.org/data/definitions/352.html)


#### WASC Id: 9

#### Source ID: 3

### [ Sec-Fetch-User Header is Missing ](https://www.zaproxy.org/docs/alerts/90005/)



##### Informational (High)

### Description

Specifies if a navigation request was initiated by a user.

* URL: https://pcsec-front-20260715t012839z/fonts/iranyekanx.css
  * Node Name: `https://pcsec-front-20260715t012839z/fonts/iranyekanx.css`
  * Method: `GET`
  * Parameter: `Sec-Fetch-User`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``
* URL: https://pcsec-front-20260715t012839z/fonts/ravagh.css
  * Node Name: `https://pcsec-front-20260715t012839z/fonts/ravagh.css`
  * Method: `GET`
  * Parameter: `Sec-Fetch-User`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``
* URL: https://pcsec-front-20260715t012839z/manifest.webmanifest
  * Node Name: `https://pcsec-front-20260715t012839z/manifest.webmanifest`
  * Method: `GET`
  * Parameter: `Sec-Fetch-User`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``
* URL: https://pcsec-front-20260715t012839z/robots.txt
  * Node Name: `https://pcsec-front-20260715t012839z/robots.txt`
  * Method: `GET`
  * Parameter: `Sec-Fetch-User`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``
* URL: https://pcsec-front-20260715t012839z/sitemap.xml
  * Node Name: `https://pcsec-front-20260715t012839z/sitemap.xml`
  * Method: `GET`
  * Parameter: `Sec-Fetch-User`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``

Instances: Systemic


### Solution

Ensure that Sec-Fetch-User header is included in user initiated requests.

### Reference


* [ https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Sec-Fetch-User ](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Sec-Fetch-User)


#### CWE Id: [ 352 ](https://cwe.mitre.org/data/definitions/352.html)


#### WASC Id: 9

#### Source ID: 3

### [ Storable and Cacheable Content ](https://www.zaproxy.org/docs/alerts/10049/)



##### Informational (Medium)

### Description

The response contents are storable by caching components such as proxy servers, and may be retrieved directly from the cache, rather than from the origin server by the caching servers, in response to similar requests from other users. If the response data is sensitive, personal or user-specific, this may result in sensitive information being leaked. In some cases, this may even result in a user gaining complete control of the session of another user, depending on the configuration of the caching components in use in their environment. This is primarily an issue where "shared" caching servers such as "proxy" caches are configured on the local network. This configuration is typically found in corporate or educational environments, for instance.

* URL: https://pcsec-front-20260715t012839z/fonts/iranyekanx.css
  * Node Name: `https://pcsec-front-20260715t012839z/fonts/iranyekanx.css`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `max-age=31536000`
  * Other Info: ``
* URL: https://pcsec-front-20260715t012839z/fonts/ravagh.css
  * Node Name: `https://pcsec-front-20260715t012839z/fonts/ravagh.css`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `max-age=31536000`
  * Other Info: ``
* URL: https://pcsec-front-20260715t012839z/fonts/vazirmatn.css
  * Node Name: `https://pcsec-front-20260715t012839z/fonts/vazirmatn.css`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `max-age=31536000`
  * Other Info: ``
* URL: https://pcsec-front-20260715t012839z/robots.txt
  * Node Name: `https://pcsec-front-20260715t012839z/robots.txt`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: ``
  * Other Info: `In the absence of an explicitly specified caching lifetime directive in the response, a liberal lifetime heuristic of 1 year was assumed. This is permitted by rfc7234.`
* URL: https://pcsec-front-20260715t012839z/sitemap.xml
  * Node Name: `https://pcsec-front-20260715t012839z/sitemap.xml`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: ``
  * Other Info: `In the absence of an explicitly specified caching lifetime directive in the response, a liberal lifetime heuristic of 1 year was assumed. This is permitted by rfc7234.`

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


