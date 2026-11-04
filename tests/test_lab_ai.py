import importlib.util
import hashlib
import json
import pathlib
import threading
import unittest
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer
from unittest.mock import patch

path = pathlib.Path(__file__).parents[1] / 'static/agent/noc_lab_ai.py'
spec = importlib.util.spec_from_file_location('lab_ai', path)
agent = importlib.util.module_from_spec(spec)
spec.loader.exec_module(agent)

class LocalAITests(unittest.TestCase):
    def test_launcher_checksum(self):
        self.assertIn(hashlib.sha256(path.read_bytes()).hexdigest(),(path.parent/'start_lab_ai.ps1').read_text())
    def test_limits(self):
        for value in [{}, {'model': 'qwen3-vl:4b-cloud', 'images': []}, {'model':'qwen3-vl:4b-instruct','images':['evil']}]:
            with self.assertRaises(ValueError):
                agent.validate_request(value)

    def test_fixed_local_request(self):
        data = {'model':'qwen3-vl:4b-instruct','images':['iVBORw0KGgo='],'task':'VLAN lab','catalog':'{}'}
        plan = {'summary':'review','uncertainties':[],'devices':[{'name':'S1','kind':'switch','interfaces':'','services':[]}]}
        with patch.object(agent, 'ollama', return_value={'message':{'content':json.dumps(plan)}}) as call:
            self.assertEqual(agent.analyze(data), plan)
            payload=call.call_args.args[1]
            self.assertFalse(payload['stream'])
            self.assertFalse(payload['format']['properties']['devices']['items']['additionalProperties'])
            self.assertNotIn('tools',payload)
            self.assertEqual(payload['options']['num_predict'],4096)

    def test_service_schema_is_bounded(self):
        schema=agent.bounded_schema(json.dumps({'services':{'vlan':{'fields':[{'key':'interface','type':'text'},{'key':'mode','type':'select','options':{'access':'Access','trunk':'Trunk'}}]}}}))
        item=schema['properties']['devices']['items']['properties']['services']['items']['anyOf'][0]
        self.assertFalse(item['additionalProperties'])
        self.assertFalse(item['properties']['data']['additionalProperties'])
        self.assertEqual(item['properties']['id']['const'],'vlan')
        self.assertEqual(schema['properties']['devices']['maxItems'],16)

    def test_origin_token_and_preflight(self):
        server=ThreadingHTTPServer(('127.0.0.1',0),agent.make_handler('test-token',{agent.ORIGIN}))
        thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
        url=f'http://127.0.0.1:{server.server_port}/health'
        try:
            for headers,code in [({},403),({'Origin':agent.ORIGIN},401),({'Origin':'https://evil.example','Authorization':'Bearer test-token'},403)]:
                with self.assertRaises(urllib.error.HTTPError) as e:
                    urllib.request.urlopen(urllib.request.Request(url,headers=headers))
                self.assertEqual(e.exception.code,code)
            req=urllib.request.Request(url,headers={'Origin':agent.ORIGIN,'Authorization':'Bearer test-token'})
            with patch.object(agent,'ollama',return_value={'models':[{'name':'qwen3-vl:4b-instruct'},{'name':'cloud'}]}):
                with urllib.request.urlopen(req) as response:
                    self.assertEqual(json.load(response)['models'],['qwen3-vl:4b-instruct'])
                    self.assertEqual(response.headers['Access-Control-Allow-Origin'],agent.ORIGIN)
                    self.assertEqual(response.headers['Cache-Control'],'no-store')
            with urllib.request.urlopen(urllib.request.Request(url,method='OPTIONS',headers={'Origin':agent.ORIGIN})) as response:
                self.assertEqual(response.status,204)
                self.assertEqual(response.headers['Access-Control-Allow-Private-Network'],'true')
        finally:
            server.shutdown();server.server_close();thread.join()

if __name__=='__main__':
    unittest.main()
