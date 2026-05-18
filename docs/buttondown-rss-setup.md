# Buttondown RSS-to-email setup

This is a dashboard configuration step, not repo code.

1. In Buttondown, open the `dyallo` newsletter.
2. Go to **Settings -> Publishing -> RSS-to-email**.
3. Enable RSS polling and set the feed URL to:

```text
https://dyallo.se/rss.xml
```

Recommended cadence: poll every 30 minutes if available. If Buttondown only exposes coarser options, choose the fastest non-manual cadence.

After the first live post, Dennis should submit a real email through the site, confirm it appears in Buttondown, publish a test post, and verify the RSS-to-email send appears in the Buttondown dashboard.
