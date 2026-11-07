"""Source inspection must not promote file presence into certified prices."""
import importlib.util
import io
from pathlib import Path
import unittest
import zipfile

spec = importlib.util.spec_from_file_location(
    "audit", Path(__file__).resolve().parents[1] / "scripts/audit_gtfs_fare_sources.py")
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


def archive(files):
    data = io.BytesIO()
    with zipfile.ZipFile(data, "w") as handle:
        for name, text in files:
            handle.writestr(name, text)
    return data.getvalue()


class FareSourceAuditTests(unittest.TestCase):
    def test_absence_does_not_mean_free(self):
        result = audit.inspect_archive(archive([("stops.txt", "stop_id,stop_name\n1,Annecy\n")]))
        self.assertEqual(result["fareFormat"], "no_price_table")
        self.assertFalse(result["fareVerified"])
        self.assertTrue(result["warnings"])

    def test_nested_v2_preserves_currency_without_certifying(self):
        result = audit.inspect_archive(archive([
            ("feed/fare_products.txt", "\ufefffare_product_id,amount,currency\np1,2.00,CHF\n")]))
        self.assertEqual(result["fareFormat"], "v2")
        self.assertEqual(result["tables"][0]["currencies"], ["CHF"])
        self.assertEqual(result["tables"][0]["rows"], 1)
        self.assertFalse(result["fareVerified"])

    def test_duplicate_basename_is_ambiguous(self):
        result = audit.inspect_archive(archive([
            ("a/fare_attributes.txt", "fare_id,price\np,0\n"),
            ("b/fare_attributes.txt", "fare_id,price\np,10\n")]))
        self.assertEqual(result["tables"][0]["status"], "ambiguous_duplicate")
        self.assertFalse(result["fareVerified"])

    def test_incomplete_schema_does_not_certify_zero(self):
        result = audit.inspect_archive(archive([("fare_attributes.txt", "fare_id,price\np,0\n")]))
        self.assertEqual(result["tables"][0]["status"], "missing_columns")
        self.assertIn("currency_type", result["tables"][0]["missingColumns"])
        self.assertFalse(result["fareVerified"])

    def test_expansion_limit_prevents_table_read(self):
        old = audit.MAX_TABLE_BYTES
        try:
            audit.MAX_TABLE_BYTES = 4
            result = audit.inspect_archive(archive([("fare_products.txt", "x" * 5)]))
        finally:
            audit.MAX_TABLE_BYTES = old
        self.assertEqual(result["tables"][0]["status"], "too_large_or_encrypted")
        self.assertFalse(result["fareVerified"])


if __name__ == "__main__":
    unittest.main()
