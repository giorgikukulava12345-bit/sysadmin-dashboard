import importlib.util
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
    def test_limits(self):
        for value in [{}, {'model': 'qwen3-vl:4b-cloud', 'images': []}, {'model':'qwen3-vl:4b','images':['evil']}]:
            with self.assertRaises(ValueError):
                agent.validate_request(value)

    def test_fixed_local_request(self):
        data = {'model':'qwen3-vl:4b','images':['iVBORw0KGgo='],'task':'VLAN lab','catalog':'{}'}
        plan = {'summary':'review','uncertainties':[],'devices':[{'name':'S1','kind':'switch','interfaces':'','services':[]}]}
        with patch.object(agent, 'ollama', return_value={'message':{'content':json.dumps(plan)}}) as call:
            self.assertEqual(agent.analyze(data), plan)
            payload=call.call_args.args[1]
            self.assertFalse(payload['stream'])
            self.assertEqual(payload['format'], agent.PLAN_SCHEMA)
            self.assertNotIn('tools',payload)

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
            with patch.object(agent,'ollama',return_value={'models':[{'name':'qwen3-vl:4b'},{'name':'cloud'}]}):
                with urllib.request.urlopen(req) as response:
                    self.assertEqual(json.load(response)['models'],['qwen3-vl:4b'])
                    self.assertEqual(response.headers['Access-Control-Allow-Origin'],agent.ORIGIN)
                    self.assertEqual(response.headers['Cache-Control'],'no-store')
            with urllib.request.urlopen(urllib.request.Request(url,method='OPTIONS',headers={'Origin':agent.ORIGIN})) as response:
                self.assertEqual(response.status,204)
                self.assertEqual(response.headers['Access-Control-Allow-Private-Network'],'true')
        finally:
            server.shutdown();server.server_close();thread.join()

if __name__=='__main__':
    unittest.main()
