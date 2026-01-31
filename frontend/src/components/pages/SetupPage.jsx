/**
 * SetupPage Component
 * Instructions for setting up OwnTracks
 */

export default function SetupPage() {
  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="bg-white rounded-lg shadow-md p-8 space-y-6">
          <h1 className="text-4xl font-bold text-neutral-900 mb-4">
            Setup Instructions
          </h1>

          <div className="prose prose-lg max-w-none">
            <h2 className="text-2xl font-semibold text-neutral-900 mt-6 mb-3">
              1. Set Up OwnTracks
            </h2>

            <p className="text-neutral-700 leading-relaxed">
              OwnTracks is a free and open-source application for iOS and Android that
              allows you to track your location and store it on your own server.
            </p>

            <ol className="list-decimal pl-6 text-neutral-700 space-y-3">
              <li>
                Download the OwnTracks app from the{' '}
                <a
                  href="https://apps.apple.com/app/owntracks/id692424691"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-500 hover:underline"
                >
                  App Store
                </a>{' '}
                or{' '}
                <a
                  href="https://play.google.com/store/apps/details?id=org.owntracks.android"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-500 hover:underline"
                >
                  Google Play
                </a>
              </li>
              <li>
                Set up an OwnTracks server. You can either:
                <ul className="list-disc pl-6 mt-2 space-y-1">
                  <li>
                    Self-host using the{' '}
                    <a
                      href="https://github.com/owntracks/recorder"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-500 hover:underline"
                    >
                      OwnTracks Recorder
                    </a>
                  </li>
                  <li>Use a cloud-hosted solution</li>
                </ul>
              </li>
              <li>
                Configure the OwnTracks app to connect to your server using HTTP mode
              </li>
              <li>Start tracking! The app will send your location to your server</li>
            </ol>

            <h2 className="text-2xl font-semibold text-neutral-900 mt-8 mb-3">
              2. Connect WhereHaveIBeen
            </h2>

            <ol className="list-decimal pl-6 text-neutral-700 space-y-3">
              <li>
                On the home page, click the login button or you'll see a login form if
                not authenticated
              </li>
              <li>Enter your OwnTracks server credentials:</li>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>
                  <strong>Username:</strong> Your OwnTracks username
                </li>
                <li>
                  <strong>Password:</strong> Your OwnTracks password
                </li>
                <li>
                  <strong>Server URL:</strong> Your OwnTracks server URL (e.g.,
                  https://owntracks.example.com)
                </li>
              </ul>
              <li>Click Login and your location history will load!</li>
            </ol>

            <h2 className="text-2xl font-semibold text-neutral-900 mt-8 mb-3">
              3. Optional: Set Up Custom OSRM Server
            </h2>

            <p className="text-neutral-700 leading-relaxed">
              For detailed road-snapped routes (used when you have fewer than 500 GPS
              points), you can optionally set up your own OSRM (Open Source Routing
              Machine) server:
            </p>

            <ol className="list-decimal pl-6 text-neutral-700 space-y-3">
              <li>
                Follow the{' '}
                <a
                  href="https://github.com/Project-OSRM/osrm-backend"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-500 hover:underline"
                >
                  OSRM setup guide
                </a>
              </li>
              <li>Once your OSRM server is running, note its URL</li>
              <li>
                In WhereHaveIBeen, open Settings and enter your OSRM server URL under
                "Custom OSRM Router"
              </li>
            </ol>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
              <h3 className="text-lg font-semibold text-blue-900 mb-2">Note</h3>
              <p className="text-blue-800 text-sm">
                If you don't set up a custom OSRM server, the app will use the default
                server. For datasets larger than 500 points, the app automatically
                switches to simpler route calculation methods for better performance.
              </p>
            </div>

            <h2 className="text-2xl font-semibold text-neutral-900 mt-8 mb-3">
              Troubleshooting
            </h2>

            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-neutral-900">
                  Can't connect to OwnTracks server
                </h3>
                <p className="text-neutral-700">
                  Make sure your server URL is correct and includes the protocol
                  (https://). Verify that your OwnTracks server is accessible from your
                  browser.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-neutral-900">
                  No data showing on map
                </h3>
                <p className="text-neutral-700">
                  Check that you've selected the correct user and device in the Filters
                  panel. Make sure your date range includes periods when you were
                  tracking your location.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-neutral-900">
                  Map is loading slowly
                </h3>
                <p className="text-neutral-700">
                  Try using the "Clear Cache" button in Settings, then reload. For very
                  large datasets (5000+ points), processing may take some time on the
                  first load, but subsequent loads will be much faster thanks to caching.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
