import ast
from pathlib import Path
import unittest
from network_validation import parse_port, validate_public_ip


class NetworkValidationTests(unittest.TestCase):
    def test_valid_ports(self):
        for value in (1, "443", 65535):
            self.assertEqual(parse_port(value), int(value))

    def test_invalid_ports(self):
        for value in (None, True, False, 1.5, "1.5", "443\n", "0", "65536", "-1"):
            with self.subTest(value=value), self.assertRaises(ValueError):
                parse_port(value)

    def test_public_ipv4(self):
        self.assertEqual(validate_public_ip("8.8.8.8"), "8.8.8.8")

    def test_internal_and_special_addresses_rejected(self):
        for value in ("127.0.0.1", "10.0.0.1", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1", "255.255.255.255", "::1", "203.0.113.10"):
            with self.subTest(value=value), self.assertRaises(ValueError):
                validate_public_ip(value)

    def test_obsolete_routes_removed_and_backend_compiles(self):
        source = Path("app.py").read_text(encoding="utf-8")
        ast.parse(source)
        self.assertNotIn('@app.route("/api/upload"', source)
        self.assertNotIn('/api/speedtest/', source)
        self.assertNotIn('/api/portcheck', source)
        self.assertNotIn('sock.connect_ex', source)


if __name__ == "__main__":
    unittest.main()
