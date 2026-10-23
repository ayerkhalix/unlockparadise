import tempfile,unittest
from pathlib import Path
from wordpress import load_sql,php
class WordPressParserTests(unittest.TestCase):
    def test_utf8_php_array_and_null(self):
        self.assertEqual(php('a:2:{i:0;s:5:"café";i:1;N;}'),['café',None])
        with self.assertRaises(ValueError):php('s:4:"café";')
    def test_dump_strings_are_data_not_executable_statements(self):
        with tempfile.TemporaryDirectory() as root:
            target=Path(root)/'synthetic.sql'
            target.write_text("CREATE TABLE `wp_test` (`id` int, `value` text);\nINSERT INTO `wp_test` (`id`,`value`) VALUES (1,'quote\\\' and \\n newline'),(2,'INSERT INTO `not_a_table` (`id`) VALUES (99);');",encoding='utf-8')
            tables=load_sql(target)
            self.assertEqual(len(tables['wp_test']),2);self.assertNotIn('not_a_table',tables)
            self.assertEqual(tables['wp_test'][0]['value'],"quote' and \n newline")
if __name__=='__main__':unittest.main()
