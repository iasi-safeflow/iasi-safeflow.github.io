"""Privacy-safe hotspot clustering of public road-safety observations.

Groups nearby non-rejected, public reports within a time window into potential risk patterns.
Clusters are labelled as potential patterns from user observations, never as official crash black spots.
"""

from collections import Counter

from .assistant.similarity import haversine_m
from .domain import PUBLIC_COORD_DECIMALS

CLUSTER_RADIUS_M = 200.0
CLUSTER_WINDOW_DAYS = 30
CLUSTER_DISCLAIMER = (
    "Tipar potențial de risc bazat pe observații ale utilizatorilor – nu este o confirmare oficială de accidente."
)


def _connected_components(rows: list[dict], radius_m: float) -> list[list[dict]]:
    n = len(rows)
    seen = [False] * n
    groups: list[list[dict]] = []
    for i in range(n):
        if seen[i]:
            continue
        seen[i] = True
        stack = [i]
        group = []
        while stack:
            cur = stack.pop()
            group.append(rows[cur])
            lat1, lon1 = round(rows[cur]["lat"], PUBLIC_COORD_DECIMALS), round(rows[cur]["lon"], PUBLIC_COORD_DECIMALS)
            for j in range(n):
                if seen[j]:
                    continue
                lat2, lon2 = round(rows[j]["lat"], PUBLIC_COORD_DECIMALS), round(rows[j]["lon"], PUBLIC_COORD_DECIMALS)
                if haversine_m(lat1, lon1, lat2, lon2) <= radius_m:
                    seen[j] = True
                    stack.append(j)
        groups.append(group)
    return groups


def build_clusters(
    rows: list[dict],
    confirmations: dict[int, int],
    *,
    radius_m: float = CLUSTER_RADIUS_M,
    street_for_row=None,
) -> list[dict]:
    """Return hotspot clusters (at least 2 reports OR at least 2 confirmations on 1 report)."""
    clusters: list[dict] = []
    for group in _connected_components(rows, radius_m):
        reports_count = len(group)
        conf_count = sum(confirmations.get(r["id"], 0) for r in group)
        if reports_count < 2 and conf_count < 2:
            continue

        # Compute centroid from public rounded coordinates so exact locations never influence the centroid.
        clat = round(sum(round(r["lat"], PUBLIC_COORD_DECIMALS) for r in group) / reports_count, PUBLIC_COORD_DECIMALS)
        clon = round(sum(round(r["lon"], PUBLIC_COORD_DECIMALS) for r in group) / reports_count, PUBLIC_COORD_DECIMALS)
        spread = max(
            haversine_m(clat, clon, round(r["lat"], PUBLIC_COORD_DECIMALS), round(r["lon"], PUBLIC_COORD_DECIMALS))
            for r in group
        )
        cat_counts = Counter(r["category"] for r in group)
        categories = [c for c, _ in cat_counts.most_common()]
        latest_date = max(r["observed_at"][:10] for r in group)
        ordered = sorted(group, key=lambda r: (r["observed_at"], r["public_id"]), reverse=True)
        area_street = None
        if street_for_row is not None:
            for r in ordered:
                area_street = street_for_row(r)
                if area_street:
                    break

        clusters.append({
            "id": "CL-" + min(r["public_id"] for r in group).removeprefix("SF-"),
            "lat": clat,
            "lon": clon,
            "radius_m": round(max(120.0, min(320.0, spread + 110.0))),
            "reports_count": reports_count,
            "confirmations_count": conf_count,
            "total_observations": reports_count + conf_count,
            "top_category": categories[0],
            "categories": categories,
            "latest_observed_date": latest_date,
            "area_street": area_street,
            "is_simulated": any(bool(r["is_simulated"]) for r in group),
            "report_ids": [r["public_id"] for r in ordered],
            "disclaimer": CLUSTER_DISCLAIMER,
        })

    return sorted(clusters, key=lambda c: (-c["total_observations"], -c["reports_count"], c["latest_observed_date"], c["id"]))
