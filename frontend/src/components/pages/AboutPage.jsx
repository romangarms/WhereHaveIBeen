/**
 * AboutPage Component
 * Information about the app and its inspiration
 */

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="bg-white rounded-lg shadow-md p-8 space-y-6">
          <h1 className="text-4xl font-bold text-neutral-900 mb-4">
            About WhereHaveIBeen
          </h1>

          <div className="prose prose-lg max-w-none">
            <h2 className="text-2xl font-semibold text-neutral-900 mt-6 mb-3">
              Inspiration from Forza Horizon
            </h2>

            <p className="text-neutral-700 leading-relaxed">
              This project was inspired by the road discovery mechanic in the Forza
              Horizon video game series. In Forza Horizon, as you drive around the
              game's open world, the roads you've traveled light up and are marked as
              "discovered" on your map. The satisfaction of gradually filling in the map
              by exploring every road is incredibly rewarding.
            </p>

            <p className="text-neutral-700 leading-relaxed">
              WhereHaveIBeen brings that same concept to real life. By visualizing your
              actual travel history from OwnTracks, you can see everywhere you've been
              as a coverage area on a map. The blue and red zones represent areas you've
              explored while driving or flying, creating a personal map of your journeys.
            </p>

            <h2 className="text-2xl font-semibold text-neutral-900 mt-8 mb-3">
              How It Works
            </h2>

            <p className="text-neutral-700 leading-relaxed">
              WhereHaveIBeen connects to your OwnTracks server and retrieves your
              location history. It then processes this data to:
            </p>

            <ul className="list-disc pl-6 text-neutral-700 space-y-2">
              <li>
                Separate driving and flying segments based on velocity and distance
                between points
              </li>
              <li>
                Calculate routes using either OSRM road snapping (for detailed routes)
                or simple line connections (for performance)
              </li>
              <li>
                Create buffer zones around your paths to show the area you've explored
              </li>
              <li>
                Calculate statistics like total distance traveled, area explored, and
                highest altitude/velocity
              </li>
              <li>
                Cache processed data locally to speed up subsequent loads
              </li>
            </ul>

            <h2 className="text-2xl font-semibold text-neutral-900 mt-8 mb-3">
              Privacy & Data
            </h2>

            <p className="text-neutral-700 leading-relaxed">
              All your location data stays between you, your OwnTracks server, and this
              application running in your browser. The app uses IndexedDB to cache
              processed buffer polygons locally for faster loading, but no data is sent
              to any third-party servers.
            </p>

            <h2 className="text-2xl font-semibold text-neutral-900 mt-8 mb-3">
              Technology
            </h2>

            <p className="text-neutral-700 leading-relaxed">
              Built with React, Leaflet for maps, Turf.js for geospatial calculations,
              and OSRM for road routing. The backend is a lightweight Flask server that
              acts as a proxy to your OwnTracks server.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
