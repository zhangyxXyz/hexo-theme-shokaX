# Visitor statistics

```yaml
visitor:
  enable: true
  type: waline
  page: true
  site: true
  readOnly: false
waline:
  serverURL: https://comments.example.com
```

`enable` controls requests, `page` and `site` control displayed counters. Waline
counts a page entry independently of opening the comments. Repeated initialization
of the same page DOM does not count again; a PJAX navigation counts as a new visit.
The site figure is the sum of stored page views (PV), not unique visitors (UV).
The Waline server must support `GET /api/article?site=1` for the site total.

The production hostname comes from Hexo `url`. Loopback hosts and other hostnames
always use read-only GET requests. `readOnly: true` also disables increments on the
production hostname. Existing `waline.pageview` is suppressed while `visitor` is
enabled, preventing double counting. A failed increment is not retried automatically.

`type: busuanzi` retains the previous behavior: local/noncanonical previews show
placeholders and make no Busuanzi request. Its site figure is the provider's UV.

In the blog toolbox configuration, `environments.local.visitor.readOnly: true`
also protects previews accessed through a LAN address. An optional environment
`waline_server_url` overrides the shared service URL for comments and visits.
No Origin or Referer spoofing is required.
