/**
 * Navigation Component
 * Top navigation bar with routing links
 */

import { Link } from 'react-router-dom';
import { LogOut } from 'lucide-react';

export default function Navigation({ isAuthenticated, onSignOut }) {
  return (
    <nav className="bg-white shadow-md">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="text-2xl font-bold text-primary-500 hover:text-primary-600 transition-colors"
          >
            WhereHaveIBeen
          </Link>

          <div className="flex items-center gap-6">
            <Link
              to="/about"
              className="text-neutral-700 hover:text-primary-500 transition-colors font-medium"
            >
              About
            </Link>

            <Link
              to="/setup"
              className="text-neutral-700 hover:text-primary-500 transition-colors font-medium"
            >
              Setup
            </Link>

            <a
              href="https://owntracks.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-700 hover:text-primary-500 transition-colors font-medium"
            >
              OwnTracks
            </a>

            {isAuthenticated && (
              <button
                onClick={onSignOut}
                className="flex items-center gap-2 text-neutral-700 hover:text-secondary-500 transition-colors font-medium"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
