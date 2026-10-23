"""Flask integration checks: python -m unittest discover -s tests."""
import unittest
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

    def test_module_assets_are_served(self):
        for filename in ['engine.js', 'address.js', 'ui.js', 'interfaces.js', 'topology.js',
                         'vendors/ios.js', 'vendors/asa.js', 'vendors/mikrotik.js',
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


if __name__ == '__main__':
    unittest.main()
