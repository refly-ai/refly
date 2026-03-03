-- Migration: update auto_model_routing_rules targets from modelId to itemId

-- Pass 1: single 'model' field
UPDATE refly.auto_model_routing_rules r
SET
  target     = jsonb_set(r.target::jsonb, '{model}', to_jsonb(pi.item_id))::text,
  updated_at = NOW()
FROM refly.provider_items pi
WHERE r.target::jsonb ? 'model'
  AND (r.target::jsonb->>'model') NOT LIKE 'pi-%'
  AND pi.config::jsonb->>'modelId' = r.target::jsonb->>'model'
  AND pi.deleted_at IS NULL
  AND pi.category = 'llm';

-- Pass 2: 'models' array
WITH models_updates AS (
  SELECT
    r.pk,
    jsonb_agg(COALESCE(to_jsonb(pi.item_id), elem)) AS new_models
  FROM refly.auto_model_routing_rules r,
    jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(r.target::jsonb->'models') = 'array' THEN r.target::jsonb->'models'
        ELSE '[]'::jsonb
      END
    ) AS elem
  LEFT JOIN refly.provider_items pi
    ON pi.config::jsonb->>'modelId' = elem#>>'{}'
    AND pi.deleted_at IS NULL
    AND pi.category = 'llm'
  WHERE r.target::jsonb ? 'models'
  GROUP BY r.pk
)
UPDATE refly.auto_model_routing_rules r
SET
  target     = jsonb_set(r.target::jsonb, '{models}', mu.new_models)::text,
  updated_at = NOW()
FROM models_updates mu
WHERE r.pk = mu.pk;

-- Pass 3: 'weights' array
WITH weights_updates AS (
  SELECT
    r.pk,
    jsonb_agg(
      CASE WHEN pi.item_id IS NOT NULL
        THEN jsonb_set(elem, '{model}', to_jsonb(pi.item_id))
        ELSE elem
      END
    ) AS new_weights
  FROM refly.auto_model_routing_rules r,
    jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(r.target::jsonb->'weights') = 'array' THEN r.target::jsonb->'weights'
        ELSE '[]'::jsonb
      END
    ) AS elem
  LEFT JOIN refly.provider_items pi
    ON pi.config::jsonb->>'modelId' = elem->>'model'
    AND pi.deleted_at IS NULL
    AND pi.category = 'llm'
  WHERE r.target::jsonb ? 'weights'
  GROUP BY r.pk
)
UPDATE refly.auto_model_routing_rules r
SET
  target     = jsonb_set(r.target::jsonb, '{weights}', wu.new_weights)::text,
  updated_at = NOW()
FROM weights_updates wu
WHERE r.pk = wu.pk;

-- Verify: all target model values should now start with 'pi-'
SELECT
    rule_id,
    rule_name,
    scene,
    priority,
    target
FROM refly.auto_model_routing_rules
ORDER BY scene, priority DESC;