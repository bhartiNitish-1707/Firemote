FIRE_TV_DEVICE_MODELS = {
    "fire_tv_4_series": "/dev/input/event0",
    "fire_tv_insignia_f20": "/dev/input/event0",
    "fire_tv_jvc-4k-2021": "/dev/input/event0",
    "fire_tv_toshiba_v35": "/dev/input/event0",
    "fire_tv_cube_third_gen": "/dev/input/event3",
    "fire_tv_cube_second_gen": "/dev/input/event5",
    "fire_tv_cube_first_gen": "/dev/input/event5",
    "fire_tv_stick_4k_max": "/dev/input/event5",
    "fire_tv_3rd_gen": "/dev/input/event4",
    "fire_tv_stick_lite": "/dev/input/event4",
    "fire_stick_4k": "/dev/input/event4",
    "fire_stick_second_gen": "/dev/input/event4",
    "fire_stick_basic": "/dev/input/event4",
    "fire_stick_first_gen": "/dev/input/event1",
    "fire_tv_third_gen_2017": "/dev/input/event3",
    "fire_tv_second_gen_2015": "/dev/input/event6",
    "mi-box-s": "undefined",
}

STICK_MODELS = [
    "fire_stick_4k",
    "fire_tv_stick_4k_max",
    "fire_tv_3rd_gen",
    "fire_stick_second_gen",
    "fire_tv_stick_4k_second_gen",
    "fire_tv_stick_4k_max_second_gen",
]


def resolve_event_path(device_type: str | None, compatibility_mode: str | None) -> str:
    if compatibility_mode and compatibility_mode != "default":
        if compatibility_mode != "strong":
            return f"/dev/input/{compatibility_mode}"
        return "undefined"

    if device_type:
        return FIRE_TV_DEVICE_MODELS.get(device_type, "undefined")

    return "undefined"


def is_stick_model(device_type: str | None) -> bool:
    return bool(device_type and device_type in STICK_MODELS)
