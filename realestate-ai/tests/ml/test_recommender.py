import pandas as pd
import pytest

from ml.recommender import PropertyRecommender


def _props():
    rows = [
        # id, city, type, beds, baths, sqft, year, price, estimate
        ("a", "Austin", "single_family", 3, 2.0, 1800, 2005, 500_000, 560_000),
        ("b", "Austin", "single_family", 3, 2.0, 1850, 2003, 520_000, 520_000),
        ("c", "Denver", "condo", 1, 1.0, 700, 1990, 300_000, 290_000),
        ("d", "Austin", "single_family", 4, 3.0, 3000, 2015, 900_000, 880_000),
        ("e", "Austin", "single_family", 3, 2.0, 1800, 2005, 500_000, 700_000),  # same as a but great value
    ]
    return pd.DataFrame(rows, columns=["id", "city", "property_type", "beds", "baths", "sqft", "year_built",
                                       "list_price", "estimate"])


def test_hard_filters():
    rec = PropertyRecommender(_props())
    got = {r.property_id for r in rec.recommend_for_lead({"budget_max": 510_000, "min_beds": 3}, k=10)}
    assert got == {"a", "b", "e"}  # d too pricey, c too small; b (+2%) within stretch


def test_value_breaks_ties_between_identical_homes():
    rec = PropertyRecommender(_props())
    top = rec.recommend_for_lead({"budget_max": 600_000, "min_beds": 3, "preferred_cities": ["Austin"]}, k=3)
    assert top[0].property_id == "e"  # same specs as "a" but 29% below estimate
    assert any("below model estimate" in r for r in top[0].reasons)
    assert top[0].score > next(r.score for r in top if r.property_id == "a")


def test_inactive_listings_excluded():
    props = _props()
    props["status"] = ["active", "sold", "active", "active", "withdrawn"]
    got = {r.property_id for r in PropertyRecommender(props).recommend_for_lead({}, k=10)}
    assert got == {"a", "c", "d"}


def test_liked_properties_pull_in_similar_homes():
    rec = PropertyRecommender(_props())
    plain = rec.recommend_for_lead({}, k=5)
    liked = rec.recommend_for_lead({"liked_property_ids": ["c"]}, k=5)  # likes the small Denver condo
    rank = lambda recs, pid: [r.property_id for r in recs].index(pid)  # noqa: E731
    assert rank(liked, "c") < rank(plain, "c")


def test_similar_excludes_self_and_orders_by_closeness():
    sims = PropertyRecommender(_props()).similar("a", k=4)
    ids = [i for i, _ in sims]
    assert "a" not in ids and ids[0] in {"b", "e"} and ids[-1] == "c"
    assert [s for _, s in sims] == sorted((s for _, s in sims), reverse=True)
    with pytest.raises(KeyError):
        PropertyRecommender(_props()).similar("zzz")


def test_no_candidates_and_missing_columns():
    assert PropertyRecommender(_props()).recommend_for_lead({"budget_max": 10_000}) == []
    with pytest.raises(ValueError):
        PropertyRecommender(_props().drop(columns=["sqft"]))
