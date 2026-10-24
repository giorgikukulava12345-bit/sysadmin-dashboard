/** Mask credential arguments only; retain CLI commands, addresses and line breaks. */
export function maskSecrets(code) {
  const value = '(?:"[^"\\r\\n]*"|\'[^\'\\r\\n]*\'|[^\\s]+)';
  const prefixes = [
    '\\b(?:secret|password|psksecret|preshared-key|private-key|PrivateKey|PresharedKey|key-string|auth-pwd|priv-pwd|authentication-password|encryption-password|privacy-password)\\b(?:[ \\t]*=[ \\t]*|[ \\t]+)(?:(?:0|5|7|8|9)[ \\t]+)?',
    '\\bpre-shared-key[ \\t]+(?:(?:ascii-text|key)[ \\t]+)?',
    '\\bcrypto[ \\t]+isakmp[ \\t]+key[ \\t]+',
    '^[ \\t]*key[ \\t]+(?!chain\\b)(?:0[ \\t]+)?(?=[^\\r\\n]*$)',
    '\\bip[ \\t]+nhrp[ \\t]+authentication[ \\t]+',
    '\\bauthentication[ \\t]+mode[ \\t]+hmac-sha-256[ \\t]+0[ \\t]+',
    '\\bauth[ \\t]+sha[ \\t]+',
    '\\bpriv[ \\t]+aes[ \\t]+128[ \\t]+'
  ];
  let masked = code;
  for (const prefix of prefixes) {
    masked = masked.replace(new RegExp('(' + prefix + ')(' + value + ')', 'gm'), (_, head, token) => {
      // A numeric key-chain entry is an identifier, not a credential.
      if (/^\s*key\s+$/.test(head) && /^\d+$/.test(token)) return head + token;
      const quote = token[0] === '"' || token[0] === "'" ? token[0] : '';
      return head + quote + '***' + quote;
    });
  }
  return masked;
}
