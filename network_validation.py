"""Pure validation helpers for the public TCP-check API."""
import ipaddress
import re


def parse_port(value):
    if isinstance(value, bool) or not re.fullmatch(r"[0-9]{1,5}", str(value)):
        raise ValueError("Port must be an integer between 1 and 65535.")
    port = int(value)
    if not 1 <= port <= 65535:
        raise ValueError("Port must be an integer between 1 and 65535.")
    return port


def validate_public_ip(value):
    address = ipaddress.ip_address(value)
    if address.version != 4 or not address.is_global or address.is_multicast:
        raise ValueError("TCP checks support public unicast IPv4 destinations only.")
    return str(address)
