"""Constrain actual score events, serialize SMF; never substitute for inference."""
import unittest
from compose import constraints, constrain_score, midi_bytes
class Constraints(unittest.TestCase):
 def test_key_range_timing(self):
  score=[480,[['set_tempo',12,500000],['time_signature',10,4,2,24,8],['note',120,240,0,35,80],['note',480,960,0,83,90]]]
  changed=constrain_score(score,key='Dm',pitch_min=57,pitch_max=77,numerator=6,denominator=8,bpm=90)
  self.assertEqual(changed,2)
  notes=[e for e in score[1] if e[0]=='note']
  self.assertEqual([(n[1],n[2],n[3],n[5]) for n in notes],[(120,240,0,80),(480,960,0,90)])
  self.assertTrue(all(57<=n[4]<=77 and n[4]%12 in {2,4,5,7,9,10,0} for n in notes))
  data,count=midi_bytes(score);self.assertEqual(count,2);self.assertIn(b'\xff\x58\x04\x06\x03\x18\x08',data)
  self.assertIn(b'\xff\x51\x03'+round(60000000/90).to_bytes(3,'big'),data)
 def test_keys_and_narrow_range(self):
  for key in ['C','C#','Db','Am','F#m','Bbm']:
   allowed=constraints(key,60,72)
   self.assertTrue(allowed)
   score=[480,[['note',0,480,0,n,80] for n in range(128)]]
   constrain_score(score,key=key,pitch_min=60,pitch_max=72)
   self.assertTrue(all(n[4] in allowed for n in score[1] if n[0]=='note'))
 def test_invalid(self):
  for settings in [dict(key='H'),dict(pitch_min=True),dict(pitch_min=78,pitch_max=57),dict(key='C',pitch_min=61,pitch_max=61),dict(numerator=0),dict(denominator=3),dict(style='invented')]:
   with self.assertRaises(ValueError):constraints(**settings)
 def test_no_key_preserves_in_range(self):
  score=[480,[['note',0,480,0,61,80]]];self.assertEqual(constrain_score(score),0);self.assertEqual(score[1][0][4],61)
if __name__=='__main__':unittest.main()
