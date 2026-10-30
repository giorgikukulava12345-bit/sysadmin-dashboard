"""Flask integration checks: python -m unittest discover -s tests."""
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch
from app import app


class DashboardIntegrationTests(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_dashboard_renders_configurator(self):
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'id="vpn-configurator"', response.data)
        self.assertIn(b'/static/vpn/ui.js', response.data)
        self.assertNotIn(b'{% include', response.data)
        self.assertNotIn(b'CORE NETWORK TOOLS', response.data)
        self.assertIn(b'Network Engineering Lab', response.data)
        self.assertNotIn(b'SYSADMIN FILE REPOSITORY', response.data)
        self.assertNotIn(b'data-repository-search', response.data)
        self.assertNotIn(b'/static/vpn/repository-search.js', response.data)

    def test_module_assets_are_served(self):
        for filename in ['engine.js', 'address.js', 'ui.js', 'interfaces.js', 'lab.js', 'platforms.js',
                         'vti.js', 'catalog.js', 'vlsm.js', 'workbench.js', 'features.js', 'compose.js',
                         'diagram.js', 'planner-ui.js', 'workbench-style.js', 'enterprise.js',
                         'vendors/juniper.js', 'vendors/ios.js', 'vendors/asa.js', 'vendors/mikrotik.js',
                         'vendors/fortinet.js', 'vendors/paloalto.js', 'vendors/wireguard.js']:
            with self.subTest(filename=filename):
                response = self.client.get('/static/vpn/' + filename)
                self.assertEqual(response.status_code, 200)
                self.assertIn('javascript', response.content_type)
                response.close()

    def test_file_endpoint_remains_available(self):
        response = self.client.get('/api/files')
        self.assertEqual(response.status_code, 200)
        self.assertIsInstance(response.get_json()['files'], list)

    def test_every_production_javascript_asset_is_served(self):
        base = Path(__file__).resolve().parents[1] / 'static'
        for file in base.rglob('*.js'):
            with self.subTest(file=file.name):
                response = self.client.get('/static/' + file.relative_to(base).as_posix())
                self.assertEqual(response.status_code, 200)
                self.assertIn('javascript', response.content_type)
                response.close()

    def test_missing_optional_repository_directory_returns_empty_list(self):
        with TemporaryDirectory() as directory, patch('app.UPLOAD_DIR', str(Path(directory) / 'absent')):
            response = self.client.get('/api/files')
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.get_json(), {'files': []})

    def test_removed_port_checker_cannot_open_sockets(self):
        with patch('socket.socket') as socket:
            response = self.client.post('/api/portcheck', json={'host': '8.8.8.8', 'port': 443})
            self.assertEqual(response.status_code, 404)
            socket.assert_not_called()

    def test_download_traversal_and_cross_drive_paths_do_not_raise_500(self):
        for path in ['/download/../app.py', '/download/D:/outside.txt', '/download/missing.txt']:
            with self.subTest(path=path):
                self.assertIn(self.client.get(path).status_code, (403, 404))


if __name__ == '__main__':
    unittest.main()
