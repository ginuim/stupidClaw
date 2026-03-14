import { Type } from "@mariozechner/pi-ai";
import type { SkillDefinition } from "../contracts.js";

interface WttrCurrentCondition {
  temp_C: string;
  FeelsLikeC: string;
  humidity: string;
  weatherDesc: { value: string }[];
  windspeedKmph: string;
  winddir16Point: string;
}

interface WttrWeatherDay {
  date: string;
  maxtempC: string;
  mintempC: string;
}

interface WttrNearestArea {
  areaName: { value: string }[];
  country: { value: string }[];
}

interface WttrResponse {
  current_condition: WttrCurrentCondition[];
  weather: WttrWeatherDay[];
  nearest_area: WttrNearestArea[];
}

export function createGetWeatherSkill(): SkillDefinition {
  return {
    name: "get_weather",
    description: "查询指定城市的实时天气与今日预报，支持中国城市（如北京、上海）及全球城市",
    exposure: "on_demand",
    tool: {
      name: "get_weather",
      label: "Get Weather",
      description:
        "Get current weather and today's forecast for any city. Supports Chinese city names.",
      parameters: Type.Object({
        city: Type.String({ description: "城市名，支持中文（如：北京）或英文（如：Shanghai）" })
      }),
      execute: async (_toolCallId, rawParams) => {
        const { city } = rawParams as { city: string };
        const url = `https://wttr.in/${encodeURIComponent(city)}?format=j1&lang=zh`;

        let res: Response;
        try {
          res = await fetch(url, {
            headers: { "User-Agent": "StupidClaw/1.0" }
          });
        } catch (err) {
          return {
            content: [{ type: "text", text: `网络请求失败：${String(err)}` }],
            details: {}
          };
        }

        if (!res.ok) {
          return {
            content: [
              { type: "text", text: `天气查询失败：HTTP ${res.status}，请检查城市名是否正确。` }
            ],
            details: {}
          };
        }

        let data: WttrResponse;
        try {
          data = (await res.json()) as WttrResponse;
        } catch {
          return {
            content: [{ type: "text", text: "解析天气数据失败，城市名可能不存在。" }],
            details: {}
          };
        }

        const cur = data.current_condition?.[0];
        const today = data.weather?.[0];
        const area = data.nearest_area?.[0];

        if (!cur || !today) {
          return {
            content: [{ type: "text", text: "未找到该城市的天气数据。" }],
            details: {}
          };
        }

        const locationName = area
          ? `${area.areaName[0]?.value ?? city}, ${area.country[0]?.value ?? ""}`
          : city;

        const text = [
          `📍 ${locationName}`,
          `天气：${cur.weatherDesc[0]?.value ?? "-"}`,
          `温度：${cur.temp_C}°C（体感 ${cur.FeelsLikeC}°C）`,
          `今日：${today.mintempC}°C ~ ${today.maxtempC}°C`,
          `湿度：${cur.humidity}%`,
          `风速：${cur.windspeedKmph} km/h，风向 ${cur.winddir16Point}`
        ].join("\n");

        return {
          content: [{ type: "text", text }],
          details: {}
        };
      }
    }
  };
}
